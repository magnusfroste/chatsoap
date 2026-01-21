import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Home,
  ExternalLink,
  Star,
  StarOff,
  Loader2,
  X,
  Plus,
  Lock,
  Unlock
} from "lucide-react";
import { CanvasAppProps } from "@/lib/canvas-apps/types";
import { canvasEventBus } from "@/lib/canvas-apps/events";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

interface Tab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
}

const DEFAULT_HOME = "https://www.google.com/webhp?igu=1";

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: "1", title: "Google", url: "https://www.google.com/webhp?igu=1" },
  { id: "2", title: "Wikipedia", url: "https://en.wikipedia.org" },
  { id: "3", title: "MDN Web Docs", url: "https://developer.mozilla.org" },
];

const MiniBrowserApp = ({ conversationId, sendToChat }: CanvasAppProps) => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "1", url: DEFAULT_HOME, title: "New Tab", isLoading: true }
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [urlInput, setUrlInput] = useState(DEFAULT_HOME);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem(`browser-bookmarks-${conversationId}`);
    return saved ? JSON.parse(saved) : DEFAULT_BOOKMARKS;
  });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Save bookmarks
  useEffect(() => {
    localStorage.setItem(`browser-bookmarks-${conversationId}`, JSON.stringify(bookmarks));
  }, [bookmarks, conversationId]);

  // Reference to navigate function for event handler
  const navigateRef = useRef<((url: string) => void) | null>(null);

  // Listen for browser navigate events from AI chat
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("browser:navigate", ({ url }) => {
      console.log("Browser received navigate event:", url);
      toast.success(`Navigating to ${url}`);
      // Use ref to access latest navigate function
      if (navigateRef.current) {
        navigateRef.current(url);
      }
    });

    return unsubscribe;
  }, []);

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const formatUrl = (input: string): string => {
    const trimmed = input.trim();
    
    // If it's already a valid URL, return it
    if (isValidUrl(trimmed)) {
      return trimmed;
    }
    
    // If it looks like a domain, add https://
    if (trimmed.includes(".") && !trimmed.includes(" ")) {
      return `https://${trimmed}`;
    }
    
    // Otherwise, treat as a search query
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&igu=1`;
  };

  const navigate = useCallback((url: string) => {
    const formattedUrl = formatUrl(url);
    
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, url: formattedUrl, isLoading: true }
        : tab
    ));
    setUrlInput(formattedUrl);
    
    // Add to history
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(formattedUrl);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [activeTabId, historyIndex]);

  // Keep navigateRef updated with latest navigate function
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const url = history[newIndex];
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, url, isLoading: true }
          : tab
      ));
      setUrlInput(url);
    }
  }, [activeTabId, history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const url = history[newIndex];
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, url, isLoading: true }
          : tab
      ));
      setUrlInput(url);
    }
  }, [activeTabId, history, historyIndex]);

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, isLoading: true }
          : tab
      ));
      iframeRef.current.src = activeTab.url;
    }
  }, [activeTabId, activeTab.url]);

  const goHome = useCallback(() => {
    navigate(DEFAULT_HOME);
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(urlInput);
  };

  const handleIframeLoad = () => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, isLoading: false, title: "Page" }
        : tab
    ));
  };

  const addBookmark = () => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      title: new URL(activeTab.url).hostname,
      url: activeTab.url,
    };
    setBookmarks(prev => [...prev, newBookmark]);
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const isBookmarked = bookmarks.some(b => b.url === activeTab.url);

  const openInNewTab = () => {
    window.open(activeTab.url, "_blank");
  };

  const addNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: DEFAULT_HOME,
      title: "New Tab",
      isLoading: true,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput(DEFAULT_HOME);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId) {
        setActiveTabId(filtered[filtered.length - 1].id);
        setUrlInput(filtered[filtered.length - 1].url);
      }
      return filtered;
    });
  };

  const isSecure = activeTab.url.startsWith("https://");

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 pt-2 bg-muted/30 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm cursor-pointer min-w-[120px] max-w-[200px] group",
              tab.id === activeTabId 
                ? "bg-background border-t border-x border-border" 
                : "bg-muted/50 hover:bg-muted"
            )}
            onClick={() => {
              setActiveTabId(tab.id);
              setUrlInput(tab.url);
            }}
          >
            {tab.isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
            ) : (
              <Globe className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate flex-1">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={addNewTab}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation Bar */}
      <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b border-border bg-card">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goBack}
            disabled={historyIndex <= 0}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refresh}
          >
            <RotateCw className={cn("w-4 h-4", activeTab.isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goHome}
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {isSecure ? (
                <Lock className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Search or enter URL..."
              className="pl-9 pr-20 h-8 bg-muted/50 text-sm"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={isBookmarked ? () => {
                  const bookmark = bookmarks.find(b => b.url === activeTab.url);
                  if (bookmark) removeBookmark(bookmark.id);
                } : addBookmark}
              >
                {isBookmarked ? (
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ) : (
                  <StarOff className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={openInNewTab}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Bookmarks Bar */}
      {bookmarks.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/20 overflow-x-auto">
          {bookmarks.map(bookmark => (
            <Button
              key={bookmark.id}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 flex-shrink-0"
              onClick={() => navigate(bookmark.url)}
            >
              <Globe className="w-3 h-3" />
              {bookmark.title}
            </Button>
          ))}
        </div>
      )}

      {/* Browser Content */}
      <div className="flex-1 relative bg-white">
        {activeTab.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={activeTab.url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onLoad={handleIframeLoad}
          title="Mini Browser"
        />
      </div>
    </div>
  );
};

export default MiniBrowserApp;
