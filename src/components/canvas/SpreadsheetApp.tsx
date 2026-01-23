import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canvasEventBus } from "@/lib/canvas-apps/events";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table2, 
  Plus, 
  Minus, 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  ArrowUpDown,
  Loader2,
  Download,
  Trash2,
  Check,
  X,
  Copy,
  ClipboardPaste,
  Undo2,
  Redo2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

interface CellData {
  value: string;
  formula?: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    align?: "left" | "center" | "right";
    bgColor?: string;
    textColor?: string;
  };
}

interface SpreadsheetData {
  cells: Record<string, CellData>;
  columns: number;
  rows: number;
}

interface SpreadsheetAppProps {
  conversationId?: string;
  initialData?: SpreadsheetData;
}

const DEFAULT_COLS = 10;
const DEFAULT_ROWS = 20;

// Color palette for cell references in formulas
const REF_COLORS = [
  { bg: "rgba(59, 130, 246, 0.2)", border: "rgb(59, 130, 246)", text: "#3b82f6" },   // blue
  { bg: "rgba(16, 185, 129, 0.2)", border: "rgb(16, 185, 129)", text: "#10b981" },   // green
  { bg: "rgba(249, 115, 22, 0.2)", border: "rgb(249, 115, 22)", text: "#f97316" },   // orange
  { bg: "rgba(139, 92, 246, 0.2)", border: "rgb(139, 92, 246)", text: "#8b5cf6" },   // purple
  { bg: "rgba(236, 72, 153, 0.2)", border: "rgb(236, 72, 153)", text: "#ec4899" },   // pink
  { bg: "rgba(234, 179, 8, 0.2)", border: "rgb(234, 179, 8)", text: "#eab308" },     // yellow
  { bg: "rgba(6, 182, 212, 0.2)", border: "rgb(6, 182, 212)", text: "#06b6d4" },     // cyan
  { bg: "rgba(239, 68, 68, 0.2)", border: "rgb(239, 68, 68)", text: "#ef4444" },     // red
];

// Extract all cell references from a formula (single cells and ranges)
const extractCellRefs = (formula: string): { ref: string; start: number; end: number; cells: string[] }[] => {
  const refs: { ref: string; start: number; end: number; cells: string[] }[] = [];
  // Match ranges like A1:B5 or single cells like A1
  const regex = /([A-Z]+\d+)(?::([A-Z]+\d+))?/gi;
  let match;
  
  while ((match = regex.exec(formula)) !== null) {
    const fullRef = match[0];
    const startCell = match[1].toUpperCase();
    const endCell = match[2]?.toUpperCase();
    
    const cells: string[] = [];
    if (endCell) {
      // It's a range - expand to all cells
      const start = parseCellRef(startCell);
      const end = parseCellRef(endCell);
      if (start && end) {
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            cells.push(getCellId(c, r));
          }
        }
      }
    } else {
      cells.push(startCell);
    }
    
    refs.push({
      ref: fullRef,
      start: match.index,
      end: match.index + fullRef.length,
      cells
    });
  }
  
  return refs;
};

// Convert column index to letter (0 = A, 1 = B, etc.)
const colToLetter = (col: number): string => {
  let letter = "";
  let temp = col;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// Convert letter to column index
const letterToCol = (letter: string): number => {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
};

// Parse cell reference (e.g., "A1" -> { col: 0, row: 0 })
const parseCellRef = (ref: string): { col: number; row: number } | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    col: letterToCol(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
};

// Get cell ID from col/row
const getCellId = (col: number, row: number): string => `${colToLetter(col)}${row + 1}`;

// Evaluate formula
const evaluateFormula = (
  formula: string, 
  cells: Record<string, CellData>,
  visited: Set<string> = new Set()
): number | string => {
  const upper = formula.toUpperCase().trim();
  
  // Check for circular reference
  const currentCellMatch = formula.match(/=.*?([A-Z]+\d+)/gi);
  if (currentCellMatch) {
    for (const ref of currentCellMatch) {
      const cleanRef = ref.replace("=", "").trim().toUpperCase();
      if (visited.has(cleanRef)) {
        return "#CIRCULAR!";
      }
    }
  }
  
  // SUM function
  const sumMatch = upper.match(/^=SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (sumMatch) {
    const start = parseCellRef(sumMatch[1]);
    const end = parseCellRef(sumMatch[2]);
    if (!start || !end) return "#REF!";
    
    let sum = 0;
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cellId = getCellId(c, r);
        const cellValue = getCellValue(cellId, cells, new Set(visited));
        const num = parseFloat(String(cellValue));
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  }
  
  // AVERAGE function
  const avgMatch = upper.match(/^=AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (avgMatch) {
    const start = parseCellRef(avgMatch[1]);
    const end = parseCellRef(avgMatch[2]);
    if (!start || !end) return "#REF!";
    
    let sum = 0;
    let count = 0;
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cellId = getCellId(c, r);
        const cellValue = getCellValue(cellId, cells, new Set(visited));
        const num = parseFloat(String(cellValue));
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  }
  
  // COUNT function
  const countMatch = upper.match(/^=COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (countMatch) {
    const start = parseCellRef(countMatch[1]);
    const end = parseCellRef(countMatch[2]);
    if (!start || !end) return "#REF!";
    
    let count = 0;
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cellId = getCellId(c, r);
        const cellValue = getCellValue(cellId, cells, new Set(visited));
        const num = parseFloat(String(cellValue));
        if (!isNaN(num)) count++;
      }
    }
    return count;
  }
  
  // MIN function
  const minMatch = upper.match(/^=MIN\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (minMatch) {
    const start = parseCellRef(minMatch[1]);
    const end = parseCellRef(minMatch[2]);
    if (!start || !end) return "#REF!";
    
    let min = Infinity;
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cellId = getCellId(c, r);
        const cellValue = getCellValue(cellId, cells, new Set(visited));
        const num = parseFloat(String(cellValue));
        if (!isNaN(num) && num < min) min = num;
      }
    }
    return min === Infinity ? 0 : min;
  }
  
  // MAX function
  const maxMatch = upper.match(/^=MAX\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (maxMatch) {
    const start = parseCellRef(maxMatch[1]);
    const end = parseCellRef(maxMatch[2]);
    if (!start || !end) return "#REF!";
    
    let max = -Infinity;
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cellId = getCellId(c, r);
        const cellValue = getCellValue(cellId, cells, new Set(visited));
        const num = parseFloat(String(cellValue));
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return max === -Infinity ? 0 : max;
  }
  
  // Simple cell reference (e.g., =A1)
  const refMatch = upper.match(/^=([A-Z]+\d+)$/);
  if (refMatch) {
    const cellId = refMatch[1];
    return getCellValue(cellId, cells, new Set(visited).add(cellId));
  }
  
  // General arithmetic expression with parentheses support
  // Supports: cell refs, numbers, +, -, *, /, parentheses
  // e.g., =(A1+B1)*C1, =A1+B1+C1*D1, =(A1+2)*3
  try {
    const expr = formula.slice(1).toUpperCase().replace(/\s/g, "");
    
    // Tokenize: numbers, cell refs, operators, parentheses
    const tokenRegex = /(\d+\.?\d*|[A-Z]+\d+|[+\-*/()])/g;
    const tokens: string[] = [];
    let match;
    let lastIndex = 0;
    
    while ((match = tokenRegex.exec(expr)) !== null) {
      if (match.index !== lastIndex) {
        // There's unrecognized content
        return "#ERROR!";
      }
      tokens.push(match[0]);
      lastIndex = tokenRegex.lastIndex;
    }
    
    if (lastIndex !== expr.length || tokens.length === 0) {
      return "#ERROR!";
    }
    
    // Recursive descent parser
    let pos = 0;
    
    const peek = (): string | null => tokens[pos] || null;
    const consume = (): string => tokens[pos++];
    
    const parseNumber = (): number | string => {
      const token = consume();
      
      // Check if it's a number
      if (/^\d+\.?\d*$/.test(token)) {
        return parseFloat(token);
      }
      
      // It's a cell reference
      if (/^[A-Z]+\d+$/.test(token)) {
        const value = getCellValue(token, cells, new Set(visited));
        const num = parseFloat(String(value));
        if (isNaN(num)) return "#VALUE!";
        return num;
      }
      
      return "#ERROR!";
    };
    
    const parseFactor = (): number | string => {
      const token = peek();
      
      if (token === "(") {
        consume(); // consume '('
        const result = parseExpression();
        if (typeof result === "string") return result;
        if (peek() !== ")") return "#ERROR!";
        consume(); // consume ')'
        return result;
      }
      
      if (token === "-") {
        consume(); // consume '-'
        const factor = parseFactor();
        if (typeof factor === "string") return factor;
        return -factor;
      }
      
      return parseNumber();
    };
    
    const parseTerm = (): number | string => {
      let left = parseFactor();
      if (typeof left === "string") return left;
      
      while (peek() === "*" || peek() === "/") {
        const op = consume();
        const right = parseFactor();
        if (typeof right === "string") return right;
        
        if (op === "*") {
          left = left * right;
        } else {
          if (right === 0) return "#DIV/0!";
          left = left / right;
        }
      }
      
      return left;
    };
    
    const parseExpression = (): number | string => {
      let left = parseTerm();
      if (typeof left === "string") return left;
      
      while (peek() === "+" || peek() === "-") {
        const op = consume();
        const right = parseTerm();
        if (typeof right === "string") return right;
        
        if (op === "+") {
          left = left + right;
        } else {
          left = left - right;
        }
      }
      
      return left;
    };
    
    const result = parseExpression();
    
    // Make sure we consumed all tokens
    if (pos !== tokens.length) {
      return "#ERROR!";
    }
    
    return result;
  } catch {
    return "#ERROR!";
  }
};

// Get computed cell value
const getCellValue = (
  cellId: string, 
  cells: Record<string, CellData>,
  visited: Set<string> = new Set()
): string | number => {
  const cell = cells[cellId];
  if (!cell) return "";
  
  if (cell.formula) {
    visited.add(cellId);
    return evaluateFormula(cell.formula, cells, visited);
  }
  
  return cell.value || "";
};

export function SpreadsheetApp({ conversationId, initialData }: SpreadsheetAppProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SpreadsheetData>({
    cells: {},
    columns: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    ...initialData,
  });
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [formulaMode, setFormulaMode] = useState(false); // Track if we're building a formula
  const [formulaSourceCell, setFormulaSourceCell] = useState<string | null>(null); // The cell where formula is being entered
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  
  // Copy/paste state
  const [copiedCell, setCopiedCell] = useState<{
    cellId: string;
    data: CellData | null;
  } | null>(null);
  
  // Drag selection state for range picking in formula mode
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  
  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<SpreadsheetData[]>([]);
  const [redoStack, setRedoStack] = useState<SpreadsheetData[]>([]);
  const MAX_HISTORY = 50;
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch spreadsheet data
  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        // Use type assertion since table was just created and types not yet regenerated
        const { data: spreadsheet, error } = await (supabase
          .from("room_spreadsheets" as any)
          .select("*")
          .eq("room_id", conversationId)
          .single() as any);

        if (error && error.code !== "PGRST116") throw error;

        if (spreadsheet?.data) {
          const spreadsheetData = spreadsheet.data as SpreadsheetData;
          setData({
            cells: spreadsheetData.cells || {},
            columns: spreadsheetData.columns || DEFAULT_COLS,
            rows: spreadsheetData.rows || DEFAULT_ROWS,
          });
        }
      } catch (error) {
        console.error("Error fetching spreadsheet:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [conversationId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!conversationId) return;
    
    const channel = supabase
      .channel(`spreadsheet-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_spreadsheets",
          filter: `room_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.new && "data" in payload.new && payload.new.updated_by !== user?.id) {
            const newData = payload.new.data as unknown as SpreadsheetData;
            setData({
              cells: newData.cells || {},
              columns: newData.columns || DEFAULT_COLS,
              rows: newData.rows || DEFAULT_ROWS,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);


  // Save data with debounce
  const saveData = useCallback(async (newData: SpreadsheetData) => {
    if (!user || !conversationId) return;
    
    setSaving(true);
    try {
      // Use type assertion since table was just created and types not yet regenerated
      const { data: existing } = await (supabase
        .from("room_spreadsheets" as any)
        .select("id")
        .eq("room_id", conversationId)
        .single() as any);

      // Cast cells to plain JSON-compatible object
      const cellsAsJson: Record<string, Record<string, unknown>> = {};
      Object.entries(newData.cells).forEach(([key, cell]) => {
        cellsAsJson[key] = {
          value: cell.value,
          formula: cell.formula,
          format: cell.format,
        };
      });

      const jsonData = {
        cells: cellsAsJson,
        columns: newData.columns,
        rows: newData.rows,
      };

      if (existing) {
        await (supabase
          .from("room_spreadsheets" as any)
          .update({
            data: jsonData,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("room_id", conversationId) as any);
      } else {
        await (supabase
          .from("room_spreadsheets" as any)
          .insert([{
            room_id: conversationId,
            data: jsonData,
            updated_by: user.id,
          }]) as any);
      }
    } catch (error) {
      console.error("Error saving spreadsheet:", error);
      toast.error("Failed to save spreadsheet");
    } finally {
      setSaving(false);
    }
  }, [conversationId, user]);

  // Debounced save
  const debouncedSave = useCallback((newData: SpreadsheetData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveData(newData);
    }, 500);
  }, [saveData]);

  // Listen for AI spreadsheet updates via event bus
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("spreadsheet:update", (payload) => {
      if (!payload.updates || !Array.isArray(payload.updates)) return;
      
      setData((prev) => {
        // Push to undo stack
        setUndoStack(stack => {
          const newStack = [...stack, JSON.parse(JSON.stringify(prev))];
          if (newStack.length > MAX_HISTORY) {
            return newStack.slice(-MAX_HISTORY);
          }
          return newStack;
        });
        setRedoStack([]);
        
        const newCells = { ...prev.cells };
        let maxRow = prev.rows;
        let maxCol = prev.columns;
        
        for (const update of payload.updates) {
          const cellId = update.cell.toUpperCase();
          const value = update.value;
          const isFormula = value.startsWith("=");
          
          // Parse cell reference to check if we need more rows/columns
          const match = cellId.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            let col = 0;
            for (let i = 0; i < match[1].length; i++) {
              col = col * 26 + (match[1].charCodeAt(i) - 64);
            }
            col -= 1; // 0-indexed
            const row = parseInt(match[2], 10) - 1; // 0-indexed
            
            // Expand grid if needed
            if (row + 1 > maxRow) maxRow = row + 1;
            if (col + 1 > maxCol) maxCol = col + 1;
          }
          
          newCells[cellId] = {
            ...newCells[cellId],
            value: isFormula ? "" : value,
            formula: isFormula ? value : undefined,
          };
        }
        
        const newData = { 
          ...prev, 
          cells: newCells,
          rows: Math.max(maxRow, prev.rows),
          columns: Math.max(maxCol, prev.columns),
        };
        
        // Save to database
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveData(newData);
        }, 500);
        
        return newData;
      });
      
      toast.success(payload.description || "Spreadsheet updated by AI");
    });
    
    return () => unsubscribe();
  }, [saveData, MAX_HISTORY]);

  // Push current state to undo stack before making changes
  const pushToUndoStack = useCallback((currentData: SpreadsheetData) => {
    setUndoStack(prev => {
      const newStack = [...prev, JSON.parse(JSON.stringify(currentData))];
      // Limit stack size
      if (newStack.length > MAX_HISTORY) {
        return newStack.slice(-MAX_HISTORY);
      }
      return newStack;
    });
    // Clear redo stack when new action is performed
    setRedoStack([]);
  }, [MAX_HISTORY]);

  // Undo function
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(data))]);
    setUndoStack(newUndoStack);
    setData(previousState);
    debouncedSave(previousState);
  }, [undoStack, data, debouncedSave]);

  // Redo function
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(data))]);
    setRedoStack(newRedoStack);
    setData(nextState);
    debouncedSave(nextState);
  }, [redoStack, data, debouncedSave]);

  // Update cell with history
  const updateCell = useCallback((cellId: string, value: string) => {
    setData((prev) => {
      // Push to undo stack before change
      pushToUndoStack(prev);
      
      const isFormula = value.startsWith("=");
      const newCells = {
        ...prev.cells,
        [cellId]: {
          ...prev.cells[cellId],
          value: isFormula ? "" : value,
          formula: isFormula ? value : undefined,
        },
      };
      const newData = { ...prev, cells: newCells };
      debouncedSave(newData);
      return newData;
    });
  }, [debouncedSave, pushToUndoStack]);

  // Toggle format with history
  const toggleFormat = useCallback((format: "bold" | "italic") => {
    if (!selectedCell) return;
    
    setData((prev) => {
      pushToUndoStack(prev);
      const cell = prev.cells[selectedCell] || { value: "" };
      const newCells = {
        ...prev.cells,
        [selectedCell]: {
          ...cell,
          format: {
            ...cell.format,
            [format]: !cell.format?.[format],
          },
        },
      };
      const newData = { ...prev, cells: newCells };
      debouncedSave(newData);
      return newData;
    });
  }, [selectedCell, debouncedSave, pushToUndoStack]);

  // Set alignment with history
  const setAlignment = useCallback((align: "left" | "center" | "right") => {
    if (!selectedCell) return;
    
    setData((prev) => {
      pushToUndoStack(prev);
      const cell = prev.cells[selectedCell] || { value: "" };
      const newCells = {
        ...prev.cells,
        [selectedCell]: {
          ...cell,
          format: {
            ...cell.format,
            align,
          },
        },
      };
      const newData = { ...prev, cells: newCells };
      debouncedSave(newData);
      return newData;
    });
  }, [selectedCell, debouncedSave, pushToUndoStack]);

  // Add/remove rows/columns with history
  const addRow = useCallback(() => {
    setData((prev) => {
      pushToUndoStack(prev);
      const newData = { ...prev, rows: prev.rows + 1 };
      debouncedSave(newData);
      return newData;
    });
  }, [debouncedSave, pushToUndoStack]);

  const addColumn = useCallback(() => {
    setData((prev) => {
      pushToUndoStack(prev);
      const newData = { ...prev, columns: prev.columns + 1 };
      debouncedSave(newData);
      return newData;
    });
  }, [debouncedSave, pushToUndoStack]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    const rows: string[][] = [];
    for (let r = 0; r < data.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < data.columns; c++) {
        const cellId = getCellId(c, r);
        const value = String(getCellValue(cellId, data.cells));
        row.push(value.includes(",") ? `"${value}"` : value);
      }
      rows.push(row);
    }
    
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  }, [data]);

  // Clear all data with history
  const clearAll = useCallback(() => {
    if (!confirm("Clear all data?")) return;
    pushToUndoStack(data);
    const newData = { cells: {}, columns: DEFAULT_COLS, rows: DEFAULT_ROWS };
    setData(newData);
    saveData(newData);
    toast.success("Spreadsheet cleared");
  }, [saveData, data, pushToUndoStack]);

  // Handle cell click
  // Check if currently in formula mode (editing value starts with =)
  const isInFormulaMode = editValue.startsWith("=") && editingCell !== null;

  // Get range reference string from two cell IDs
  const getRangeRef = useCallback((startCell: string, endCell: string): string => {
    const start = parseCellRef(startCell);
    const end = parseCellRef(endCell);
    if (!start || !end) return startCell;
    
    // Normalize to top-left:bottom-right
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    
    const topLeft = getCellId(minCol, minRow);
    const bottomRight = getCellId(maxCol, maxRow);
    
    // If same cell, return single reference
    if (topLeft === bottomRight) return topLeft;
    return `${topLeft}:${bottomRight}`;
  }, []);

  // Check if a cell is in the drag selection range
  const isCellInDragRange = useCallback((cellId: string): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    
    const cell = parseCellRef(cellId);
    const start = parseCellRef(dragStart);
    const end = parseCellRef(dragEnd);
    if (!cell || !start || !end) return false;
    
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    
    return cell.col >= minCol && cell.col <= maxCol && cell.row >= minRow && cell.row <= maxRow;
  }, [isDragging, dragStart, dragEnd]);

  // Handle mouse down on cell - start drag or prevent blur
  const handleCellMouseDown = useCallback((cellId: string, e: React.MouseEvent) => {
    if (isInFormulaMode && formulaSourceCell && cellId !== formulaSourceCell) {
      e.preventDefault(); // Prevent blur from firing
      // Start drag selection
      setIsDragging(true);
      setDragStart(cellId);
      setDragEnd(cellId);
    }
  }, [isInFormulaMode, formulaSourceCell]);

  // Handle mouse enter on cell during drag
  const handleCellMouseEnter = useCallback((cellId: string) => {
    if (isDragging && isInFormulaMode) {
      setDragEnd(cellId);
    }
  }, [isDragging, isInFormulaMode]);

  // Track if we just finished dragging to prevent click from also adding ref
  const justFinishedDragging = useRef(false);

  // Focus formula input and place cursor at end
  const focusFormulaInput = useCallback((newValue?: string) => {
    // Use setTimeout with 0 to ensure this runs after React state updates
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at end - use the passed value length or current input value length
        const len = newValue !== undefined ? newValue.length : inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  }, []);

  // Handle mouse up - end drag and insert range
  const handleCellMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd && isInFormulaMode) {
      const rangeRef = getRangeRef(dragStart, dragEnd);
      setEditValue(prev => {
        const newValue = prev + rangeRef;
        focusFormulaInput(newValue);
        return newValue;
      });
      justFinishedDragging.current = true;
      // Reset the flag after a short delay
      setTimeout(() => { justFinishedDragging.current = false; }, 50);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, isInFormulaMode, getRangeRef, focusFormulaInput]);

  // Handle cell click - either add to formula or select cell
  const handleCellClick = useCallback((cellId: string, e?: React.MouseEvent) => {
    // If just finished dragging, don't process click (mouseUp already handled it)
    if (justFinishedDragging.current) return;
    
    // If in formula mode, append cell reference instead of navigating
    if (isInFormulaMode && formulaSourceCell && cellId !== formulaSourceCell) {
      e?.preventDefault();
      setEditValue(prev => {
        const newValue = prev + cellId;
        focusFormulaInput(newValue);
        return newValue;
      });
      return;
    }
    
    // Normal cell selection
    setSelectedCell(cellId);
    setEditingCell(cellId);
    setFormulaSourceCell(cellId);
    const cell = data.cells[cellId];
    setEditValue(cell?.formula || cell?.value || "");
  }, [data.cells, isInFormulaMode, formulaSourceCell, focusFormulaInput]);

  // Handle cell double-click - select all text
  const handleCellDoubleClick = useCallback((cellId: string) => {
    setSelectedCell(cellId);
    setEditingCell(cellId);
    setFormulaSourceCell(cellId);
    const cell = data.cells[cellId];
    setEditValue(cell?.formula || cell?.value || "");
    setTimeout(() => {
      const activeInput = document.activeElement as HTMLInputElement;
      activeInput?.select?.();
    }, 0);
  }, [data.cells]);

  // Handle key down in cell
  const handleKeyDown = useCallback((e: React.KeyboardEvent, cellId: string) => {
    const ref = parseCellRef(cellId);
    const isFormula = editValue.startsWith("=");
    
    if (e.key === "Enter") {
      if (editingCell) {
        updateCell(cellId, editValue);
        setEditingCell(null);
        setFormulaSourceCell(null);
        // Move to next row
        if (ref && ref.row < data.rows - 1) {
          const nextCellId = getCellId(ref.col, ref.row + 1);
          setSelectedCell(nextCellId);
          setEditingCell(nextCellId);
          setFormulaSourceCell(nextCellId);
          setEditValue(data.cells[nextCellId]?.formula || data.cells[nextCellId]?.value || "");
        }
      } else {
        handleCellDoubleClick(cellId);
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setFormulaSourceCell(null);
      setSelectedCell(cellId);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (editingCell) {
        updateCell(cellId, editValue);
      }
      if (ref) {
        const nextCol = e.shiftKey ? ref.col - 1 : ref.col + 1;
        if (nextCol >= 0 && nextCol < data.columns) {
          const nextCellId = getCellId(nextCol, ref.row);
          setSelectedCell(nextCellId);
          setEditingCell(nextCellId);
          setFormulaSourceCell(nextCellId);
          setEditValue(data.cells[nextCellId]?.formula || data.cells[nextCellId]?.value || "");
        }
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // In formula mode, arrow keys add cell references
      if (isFormula && formulaSourceCell === cellId) {
        // Check if cursor is at end of input (ready to add cell ref)
        const input = e.target as HTMLInputElement;
        const atEnd = input.selectionEnd === editValue.length;
        const lastChar = editValue.slice(-1);
        const readyForRef = atEnd && (lastChar === "=" || lastChar === "+" || lastChar === "-" || lastChar === "*" || lastChar === "/" || lastChar === "(" || lastChar === ":" || lastChar === ",");
        
        if (readyForRef && ref) {
          e.preventDefault();
          let targetCol = ref.col;
          let targetRow = ref.row;
          
          if (e.key === "ArrowUp" && ref.row > 0) targetRow--;
          if (e.key === "ArrowDown" && ref.row < data.rows - 1) targetRow++;
          if (e.key === "ArrowLeft" && ref.col > 0) targetCol--;
          if (e.key === "ArrowRight" && ref.col < data.columns - 1) targetCol++;
          
          const targetCellId = getCellId(targetCol, targetRow);
          setEditValue(prev => prev + targetCellId);
          return;
        }
      }
      
      // Normal navigation when not in formula mode or cursor not ready
      const input = e.target as HTMLInputElement;
      const atStart = input.selectionStart === 0;
      const atEnd = input.selectionEnd === editValue.length;
      
      // Allow arrow navigation when cell is empty or at boundaries
      const shouldNavigate = !isFormula && (editValue === "" || 
        (e.key === "ArrowLeft" && atStart) || 
        (e.key === "ArrowRight" && atEnd) ||
        e.key === "ArrowUp" || 
        e.key === "ArrowDown");
      
      if (shouldNavigate && ref) {
        e.preventDefault();
        if (editingCell) {
          updateCell(cellId, editValue);
        }
        
        let nextCol = ref.col;
        let nextRow = ref.row;
        
        if (e.key === "ArrowUp" && ref.row > 0) nextRow--;
        if (e.key === "ArrowDown" && ref.row < data.rows - 1) nextRow++;
        if (e.key === "ArrowLeft" && ref.col > 0) nextCol--;
        if (e.key === "ArrowRight" && ref.col < data.columns - 1) nextCol++;
        
        if (nextCol !== ref.col || nextRow !== ref.row) {
          const nextCellId = getCellId(nextCol, nextRow);
          setSelectedCell(nextCellId);
          setEditingCell(nextCellId);
          setFormulaSourceCell(nextCellId);
          setEditValue(data.cells[nextCellId]?.formula || data.cells[nextCellId]?.value || "");
        }
      }
    }
  }, [editingCell, editValue, updateCell, data.rows, data.columns, data.cells, handleCellDoubleClick, formulaSourceCell]);

  // Copy cell
  const copyCell = useCallback(() => {
    if (!selectedCell) return;
    const cellData = data.cells[selectedCell] || null;
    setCopiedCell({
      cellId: selectedCell,
      data: cellData ? { ...cellData } : null
    });
    
    // Also copy to system clipboard
    const displayValue = cellData?.formula || cellData?.value || "";
    navigator.clipboard.writeText(String(displayValue)).catch(() => {
      // Ignore clipboard errors
    });
  }, [selectedCell, data.cells]);

  // Paste cell with history
  const pasteCell = useCallback(() => {
    if (!selectedCell || !copiedCell) return;
    
    pushToUndoStack(data);
    
    const newCells = { ...data.cells };
    
    if (copiedCell.data) {
      // Paste cell data (preserving format)
      newCells[selectedCell] = {
        ...copiedCell.data,
      };
    } else {
      // Clear the cell if copied cell was empty
      delete newCells[selectedCell];
    }
    
    const newData = { ...data, cells: newCells };
    setData(newData);
    saveData(newData);
    
    // Update edit value if we're editing
    if (editingCell === selectedCell) {
      setEditValue(copiedCell.data?.formula || copiedCell.data?.value || "");
    }
  }, [selectedCell, copiedCell, data, saveData, editingCell, pushToUndoStack]);

  // Global keyboard handler for copy/paste/undo/redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle when not typing in an input (except our formula bar)
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      const isFormulaBar = target === inputRef.current;
      
      // Undo - Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (!isInInput || isFormulaBar) {
          if (!isInFormulaMode) {
            e.preventDefault();
            undo();
            return;
          }
        }
      }
      
      // Redo - Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (!isInInput || isFormulaBar) {
          if (!isInFormulaMode) {
            e.preventDefault();
            redo();
            return;
          }
        }
      }
      
      // For copy, we can intercept even in formula bar
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedCell && !isInFormulaMode) {
        e.preventDefault();
        copyCell();
        return;
      }
      
      // For paste, only when not actively typing in formula mode
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && selectedCell && copiedCell) {
        if (!isInInput || isFormulaBar) {
          if (!isInFormulaMode) {
            e.preventDefault();
            pasteCell();
          }
        }
      }
    };
    
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedCell, copiedCell, copyCell, pasteCell, isInFormulaMode, undo, redo]);

  // Computed values for display
  const computedValues = useMemo(() => {
    const values: Record<string, string | number> = {};
    Object.keys(data.cells).forEach((cellId) => {
      values[cellId] = getCellValue(cellId, data.cells);
    });
    return values;
  }, [data.cells]);

  // Extract cell references from current formula for color coding
  const formulaRefs = useMemo(() => {
    if (!isInFormulaMode || !editValue.startsWith("=")) return [];
    return extractCellRefs(editValue);
  }, [isInFormulaMode, editValue]);

  // Map cell ID to its color index
  const cellColorMap = useMemo(() => {
    const map: Record<string, number> = {};
    formulaRefs.forEach((ref, index) => {
      const colorIndex = index % REF_COLORS.length;
      ref.cells.forEach(cellId => {
        if (!map[cellId]) {
          map[cellId] = colorIndex;
        }
      });
    });
    return map;
  }, [formulaRefs]);

  // Render formula with colored references
  const renderColoredFormula = useMemo(() => {
    if (!isInFormulaMode || !editValue.startsWith("=") || formulaRefs.length === 0) {
      return null;
    }
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    formulaRefs.forEach((ref, index) => {
      const colorIndex = index % REF_COLORS.length;
      const color = REF_COLORS[colorIndex];
      
      // Add text before this reference
      if (ref.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {editValue.slice(lastIndex, ref.start)}
          </span>
        );
      }
      
      // Add colored reference
      parts.push(
        <span
          key={`ref-${index}`}
          className="px-0.5 rounded font-semibold"
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          {editValue.slice(ref.start, ref.end)}
        </span>
      );
      
      lastIndex = ref.end;
    });
    
    // Add remaining text
    if (lastIndex < editValue.length) {
      parts.push(
        <span key="text-end">{editValue.slice(lastIndex)}</span>
      );
    }
    
    return parts;
  }, [isInFormulaMode, editValue, formulaRefs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedCellData = selectedCell ? data.cells[selectedCell] : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30 flex-wrap">
        <div className="flex items-center gap-1 mr-2">
          <Table2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Spreadsheet</span>
          {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
        </div>
        
        <div className="h-4 w-px bg-border mx-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={undo} 
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={redo} 
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
        
        <div className="h-4 w-px bg-border mx-1" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => toggleFormat("bold")}
          disabled={!selectedCell}
        >
          <Bold className={cn("w-3.5 h-3.5", selectedCellData?.format?.bold && "text-primary")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => toggleFormat("italic")}
          disabled={!selectedCell}
        >
          <Italic className={cn("w-3.5 h-3.5", selectedCellData?.format?.italic && "text-primary")} />
        </Button>
        
        <div className="h-4 w-px bg-border mx-1" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setAlignment("left")}
          disabled={!selectedCell}
        >
          <AlignLeft className={cn("w-3.5 h-3.5", selectedCellData?.format?.align === "left" && "text-primary")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setAlignment("center")}
          disabled={!selectedCell}
        >
          <AlignCenter className={cn("w-3.5 h-3.5", selectedCellData?.format?.align === "center" && "text-primary")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setAlignment("right")}
          disabled={!selectedCell}
        >
          <AlignRight className={cn("w-3.5 h-3.5", selectedCellData?.format?.align === "right" && "text-primary")} />
        </Button>
        
        <div className="h-4 w-px bg-border mx-1" />
        
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addRow} title="Add row">
          <Plus className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addColumn} title="Add column">
          <ArrowUpDown className="w-3.5 h-3.5 rotate-90" />
        </Button>
        
        <div className="h-4 w-px bg-border mx-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={copyCell} 
          disabled={!selectedCell}
          title="Copy (Ctrl+C)"
        >
          <Copy className={cn("w-3.5 h-3.5", copiedCell && "text-primary")} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={pasteCell} 
          disabled={!selectedCell || !copiedCell}
          title="Paste (Ctrl+V)"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportCSV} title="Export CSV">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={clearAll} title="Clear all">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Formula bar */}
      <div className={cn(
        "flex items-center gap-2 p-2 border-b border-border",
        isInFormulaMode ? "bg-primary/10" : "bg-muted/20"
      )}>
        <span className={cn(
          "text-xs font-mono w-8 shrink-0",
          isInFormulaMode ? "text-primary font-semibold" : "text-muted-foreground"
        )}>
          {selectedCell || ""}
        </span>
        
        {/* Confirm/Cancel buttons for formula mode */}
        {isInFormulaMode && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 bg-green-500/20 hover:bg-green-500/30 text-green-600"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (selectedCell) {
                  updateCell(selectedCell, editValue);
                  setEditingCell(null);
                  setFormulaSourceCell(null);
                }
              }}
              title="Confirm formula (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 text-red-600"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (selectedCell) {
                  const originalValue = data.cells[selectedCell]?.formula || data.cells[selectedCell]?.value || "";
                  setEditValue(originalValue);
                  setEditingCell(null);
                  setFormulaSourceCell(null);
                }
              }}
              title="Cancel (Escape)"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        
        {isInFormulaMode && (
          <span className="text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded shrink-0">
            Click cells to add references
          </span>
        )}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={editingCell ? editValue : (selectedCellData?.formula || selectedCellData?.value || "")}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => selectedCell && handleKeyDown(e, selectedCell)}
            onBlur={() => {
              // In formula mode, don't auto-save on blur - require explicit confirm
              if (isInFormulaMode) return;
              
              if (editingCell && selectedCell) {
                updateCell(selectedCell, editValue);
                setEditingCell(null);
                setFormulaSourceCell(null);
              }
            }}
            className={cn(
              "h-7 text-xs font-mono w-full",
              isInFormulaMode && "ring-1 ring-primary",
              renderColoredFormula && "text-transparent caret-foreground"
            )}
            placeholder={selectedCell ? "Enter value or formula (=SUM, =AVERAGE, etc.)" : "Select a cell"}
            disabled={!selectedCell}
          />
          {/* Colored formula overlay */}
          {renderColoredFormula && (
            <div className="absolute inset-0 flex items-center px-3 text-xs font-mono pointer-events-none overflow-hidden">
              {renderColoredFormula}
            </div>
          )}
        </div>
      </div>

      {/* Spreadsheet grid */}
      <ScrollArea className="flex-1">
        <div className="inline-block min-w-full">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 w-10 h-6 bg-muted border border-border text-muted-foreground font-normal" />
                {Array.from({ length: data.columns }, (_, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-10 w-20 h-6 bg-muted border border-border text-muted-foreground font-normal"
                  >
                    {colToLetter(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: data.rows }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="sticky left-0 z-10 w-10 h-6 bg-muted border border-border text-muted-foreground text-center">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: data.columns }, (_, colIndex) => {
                    const cellId = getCellId(colIndex, rowIndex);
                    const cell = data.cells[cellId];
                    const isSelected = selectedCell === cellId;
                    const isEditing = editingCell === cellId;
                    const displayValue = computedValues[cellId] ?? "";
                    const isInDragRange = isCellInDragRange(cellId);
                    const refColorIndex = cellColorMap[cellId];
                    const refColor = refColorIndex !== undefined ? REF_COLORS[refColorIndex] : null;
                    const isCopied = copiedCell?.cellId === cellId;
                    
                      return (
                        <td
                          key={colIndex}
                          className={cn(
                            "w-20 h-6 border-2 p-0 relative cursor-cell select-none",
                            isSelected && "ring-2 ring-primary ring-inset",
                            isInFormulaMode && formulaSourceCell && cellId !== formulaSourceCell && !refColor && "hover:bg-primary/10",
                            isInDragRange && "bg-primary/20",
                            cell?.format?.bold && "font-bold",
                            cell?.format?.italic && "italic",
                            isCopied && "border-dashed border-primary"
                          )}
                          style={{
                            textAlign: cell?.format?.align || "left",
                            backgroundColor: refColor ? refColor.bg : (isInDragRange ? undefined : cell?.format?.bgColor),
                            borderColor: isCopied ? undefined : (refColor ? refColor.border : "hsl(var(--border))"),
                            color: cell?.format?.textColor,
                          }}
                          onMouseDown={(e) => handleCellMouseDown(cellId, e)}
                          onMouseEnter={() => handleCellMouseEnter(cellId)}
                          onMouseUp={handleCellMouseUp}
                          onClick={(e) => handleCellClick(cellId, e)}
                          onDoubleClick={() => handleCellDoubleClick(cellId)}
                        >
                        {isEditing ? (
                          <input
                            className="absolute inset-0 w-full h-full px-1 text-xs bg-background border-0 outline-none"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, cellId)}
                            onBlur={() => {
                              updateCell(cellId, editValue);
                              setEditingCell(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="block px-1 truncate">
                            {String(displayValue)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>
          {data.rows} rows × {data.columns} columns
        </span>
        <span>
          Formulas: SUM, AVERAGE, COUNT, MIN, MAX
        </span>
      </div>
    </div>
  );
}

export default SpreadsheetApp;
