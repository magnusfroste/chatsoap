/**
 * Tool Registry
 * 
 * Manages AI tools with their definitions and prompt instructions.
 * Each tool is self-contained with its own documentation.
 * Third-party plugins can register additional tools.
 */

import type { ToolModule, ToolContext, ToolResult } from "./types.ts";

const tools: Map<string, ToolModule> = new Map();

/**
 * Register a tool module
 */
export function registerTool(tool: ToolModule): void {
  tools.set(tool.id, tool);
}

/**
 * Get a tool by ID
 */
export function getTool(id: string): ToolModule | undefined {
  return tools.get(id);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolModule[] {
  return Array.from(tools.values());
}

/**
 * Get tools filtered by availability and settings
 */
export async function getAvailableTools(
  settings: Record<string, boolean>,
  context?: Partial<ToolContext>
): Promise<ToolModule[]> {
  const available: ToolModule[] = [];
  
  for (const tool of tools.values()) {
    // Check if tool is enabled in settings
    if (!settings[tool.id]) continue;
    
    // Check if tool passes its own availability check
    if (tool.isAvailable) {
      const isAvail = await tool.isAvailable();
      if (!isAvail) continue;
    }
    
    available.push(tool);
  }
  
  return available;
}

/**
 * Build prompt instructions for enabled tools
 */
export function buildToolInstructions(enabledTools: ToolModule[]): string {
  if (enabledTools.length === 0) return "";
  
  const instructions = enabledTools
    .map(tool => `- ${tool.definition.function.name}: ${tool.promptInstructions}`)
    .join("\n");
  
  return `\n\n## Available Tools\n${instructions}`;
}

// ============================================
// BUILT-IN TOOLS
// ============================================

registerTool({
  id: "analyze_images",
  definition: {
    type: "function",
    function: {
      name: "analyze_images",
      description: "Analyze attached images using vision capabilities",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to analyze in the images",
          },
        },
        required: ["query"],
      },
    },
  },
  promptInstructions: "Use ONLY when the user explicitly asks to analyze, describe, or explain attached images. Don't use unless images are attached and the user requests analysis.",
  execute: async (args, context): Promise<ToolResult> => {
    // Implementation handled in main edge function
    return { success: true, content: "Image analysis triggered" };
  },
});

registerTool({
  id: "web_search",
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
  },
  promptInstructions: "Use when you need current/recent information that might be outdated in your training data. Great for news, documentation, or fact-checking.",
  isAvailable: () => !!Deno.env.get("FIRECRAWL_API_KEY"),
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Web search triggered" };
  },
});

registerTool({
  id: "generate_image",
  definition: {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image based on a text description",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate",
          },
        },
        required: ["prompt"],
      },
    },
  },
  promptInstructions: "Use when the user asks you to create, draw, generate, or visualize an image. Provide detailed, specific prompts for best results.",
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Image generation triggered" };
  },
});

registerTool({
  id: "code_execution",
  definition: {
    type: "function",
    function: {
      name: "code_execution",
      description: "Execute code and return the result",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code to execute",
          },
          language: {
            type: "string",
            description: "Programming language (javascript, python, etc.)",
          },
        },
        required: ["code", "language"],
      },
    },
  },
  promptInstructions: "Use when the user asks you to run or execute code and show the result. The output will appear in the chat.",
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Code execution triggered" };
  },
});

registerTool({
  id: "send_code_to_sandbox",
  definition: {
    type: "function",
    function: {
      name: "send_code_to_sandbox",
      description: "Send code to the collaborative Code Sandbox canvas",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code to send to sandbox",
          },
          language: {
            type: "string",
            description: "Programming language",
          },
          filename: {
            type: "string",
            description: "Optional filename for the code",
          },
        },
        required: ["code", "language"],
      },
    },
  },
  promptInstructions: 'Use when the user asks you to "write a function", "create code", "show me code", or wants to collaborate on code. This sends code to the shared Code Sandbox where everyone can see, edit, and run it together. ALWAYS prefer this over inline code for substantial code examples!',
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Code sent to sandbox" };
  },
});

registerTool({
  id: "generate_slides",
  definition: {
    type: "function",
    function: {
      name: "generate_slides",
      description: "Generate a presentation/slideshow",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Presentation title",
          },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                notes: { type: "string" },
                layout: {
                  type: "string",
                  enum: ["title", "title-content", "bullets", "quote", "two-column"],
                },
              },
              required: ["title", "content", "layout"],
            },
            description: "Array of slide objects",
          },
          theme: {
            type: "string",
            enum: ["dark", "light", "minimal", "bold"],
            description: "Visual theme for the presentation",
          },
        },
        required: ["title", "slides"],
      },
    },
  },
  promptInstructions: "Use when the user asks to create a presentation, slideshow, pitch deck, or slides. Generate well-structured slides with clear titles, bullet points, and speaker notes. The slides will open in the Slides canvas app.",
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Slides generated" };
  },
});

registerTool({
  id: "navigate_browser",
  definition: {
    type: "function",
    function: {
      name: "navigate_browser",
      description: "Navigate the Mini Browser canvas app to a URL",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to navigate to",
          },
        },
        required: ["url"],
      },
    },
  },
  promptInstructions: 'Use when the user asks you to "go to", "open", "visit", or "navigate to" a website. This will open the URL in the shared Mini Browser canvas.',
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Browser navigated" };
  },
});

registerTool({
  id: "update_spreadsheet",
  definition: {
    type: "function",
    function: {
      name: "update_spreadsheet",
      description: "Update cells in the collaborative spreadsheet with values or formulas",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                cell: {
                  type: "string",
                  description: "Cell reference (e.g., A1, B2, C10)",
                },
                value: {
                  type: "string",
                  description: "Value or formula to set (formulas start with =, e.g., =SUM(A1:A5))",
                },
              },
              required: ["cell", "value"],
            },
            description: "Array of cell updates to apply",
          },
          description: {
            type: "string",
            description: "Brief description of what was added to the spreadsheet",
          },
        },
        required: ["updates"],
      },
    },
  },
  promptInstructions: 'Use when the user asks to fill cells, create tables, add data, or write formulas in the spreadsheet. Examples: "fill A1:A5 with 1-5", "create a budget table", "calculate the sum in B10". Supported formulas: =SUM, =AVERAGE, =COUNT, =MIN, =MAX, and arithmetic with cell references like =A1+B1*C1. ALWAYS use this tool for spreadsheet requests!',
  execute: async (args, context): Promise<ToolResult> => {
    return { success: true, content: "Spreadsheet updated" };
  },
});
