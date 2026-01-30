import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCAGContext } from "@/hooks/useCAGContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatEmptyState from "@/components/ChatEmptyState";
import DirectChat from "./DirectChat";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { WorkspaceCanvas, CanvasApp } from "@/components/WorkspaceCanvas";
import { canvasEventBus } from "@/lib/canvas-apps";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Lazy load GroupChat
const GroupChat = lazy(() => import("./GroupChat"));

const Chats = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [isCanvasCollapsed, setIsCanvasCollapsed] = useState(() => {
    const saved = localStorage.getItem('canvas-collapsed');
    return saved === 'true';
  });
  const [canvasActiveTab, setCanvasActiveTab] = useState<CanvasApp>(() => {
    const saved = localStorage.getItem('workspace-canvas-app');
    return (saved as CanvasApp) || "notes";
  });

  const toggleCanvasCollapse = useCallback(() => {
    setIsCanvasCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('canvas-collapsed', String(newValue));
      return newValue;
    });
  }, []);
  
  // Check if we're on a chat subpage
  const isDirectChat = location.pathname.startsWith("/chat/");
  const isGroupChat = location.pathname.startsWith("/group/");
  const isOnChatPage = isDirectChat || isGroupChat;
  
  // Get the active conversation ID from the URL
  const activeConversationId = params.id;

  // Determine conversation type
  const conversationType = isGroupChat ? "group" : isDirectChat ? "direct" : undefined;
  
  // CAG context for the active conversation
  const cagContext = useCAGContext(activeConversationId);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-collapsed', String(newValue));
      return newValue;
    });
  };

  const handleCanvasTabChange = useCallback((tab: CanvasApp) => {
    setCanvasActiveTab(tab);
    localStorage.setItem('workspace-canvas-app', tab);
  }, []);

  // Listen for app:open events from AI chat
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("app:open", ({ appId }) => {
      setCanvasActiveTab(appId as CanvasApp);
      localStorage.setItem('workspace-canvas-app', appId);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderChatContent = () => {
    if (isDirectChat) {
      return (
        <DirectChat 
          cagFiles={cagContext.selectedFiles} 
          cagNotes={cagContext.selectedNotes}
          onRemoveCAGFile={cagContext.removeFile} 
          onRemoveCAGNote={cagContext.removeNote}
          onClearCAG={cagContext.clearAll}
        />
      );
    }
    if (isGroupChat) {
      return (
        <Suspense fallback={
          <div className="h-full flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <GroupChat 
            cagFiles={cagContext.selectedFiles} 
            cagNotes={cagContext.selectedNotes}
            onRemoveCAGFile={cagContext.removeFile} 
            onRemoveCAGNote={cagContext.removeNote}
            onClearCAG={cagContext.clearAll}
          />
        </Suspense>
      );
    }
    return <ChatEmptyState />;
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile: Show only sidebar if not on chat page */}
      <div className="w-full md:hidden min-w-0 overflow-hidden">
        {!isOnChatPage ? (
          <ChatSidebar activeConversationId={activeConversationId} />
        ) : (
          renderChatContent()
        )}
      </div>

      {/* Desktop: All panels with ResizablePanelGroup */}
      <div className="hidden md:flex w-full h-full">
        <ResizablePanelGroup direction="horizontal" className="min-w-0">
          {/* Left Sidebar - Conversations List */}
          {!isSidebarCollapsed ? (
            <>
              <ResizablePanel 
                defaultSize={20} 
                minSize={15} 
                maxSize={35}
                className="min-w-0 overflow-hidden relative"
              >
                <div className="absolute inset-0 overflow-hidden">
                  <ChatSidebar 
                    activeConversationId={activeConversationId} 
                    isCollapsed={false}
                    onToggleCollapse={toggleSidebarCollapse}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          ) : (
            <div className="w-[72px] flex-shrink-0 flex flex-col border-r border-border">
              <ChatSidebar 
                activeConversationId={activeConversationId} 
                isCollapsed={true}
                onToggleCollapse={toggleSidebarCollapse}
              />
            </div>
          )}

          {/* Middle - Chat Area */}
          <ResizablePanel 
            defaultSize={isCanvasCollapsed ? 80 : 35} 
            minSize={25} 
            className="min-w-0"
          >
            <div className="h-full flex flex-col min-w-0 overflow-hidden relative">
              {renderChatContent()}
              
              {/* Canvas Toggle Button - positioned at top-right of chat */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCanvasCollapse}
                    className="absolute top-3 right-3 h-8 w-8 bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-muted z-10"
                  >
                    {isCanvasCollapsed ? (
                      <PanelRightOpen className="h-4 w-4" />
                    ) : (
                      <PanelRightClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {isCanvasCollapsed ? "Show workspace" : "Hide workspace"}
                </TooltipContent>
              </Tooltip>
            </div>
          </ResizablePanel>

          {!isCanvasCollapsed && (
            <>
              <ResizableHandle withHandle />

              {/* Right - Canvas/Workspace */}
              <ResizablePanel defaultSize={45} minSize={30} className="min-w-0">
                <WorkspaceCanvas 
                  conversationId={activeConversationId}
                  conversationType={conversationType as "direct" | "group" | "ai_chat" | undefined}
                  cagContext={{
                    selectedFiles: cagContext.selectedFiles,
                    toggleFile: cagContext.toggleFile,
                    isFileSelected: cagContext.isFileSelected,
                    selectedNotes: cagContext.selectedNotes,
                    toggleNote: cagContext.toggleNote,
                    isNoteSelected: cagContext.isNoteSelected,
                  }}
                  activeTab={canvasActiveTab}
                  onTabChange={handleCanvasTabChange}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Notification Permission Banner */}
      <NotificationPermissionBanner />

      {/* Incoming Call Overlay is now handled globally by AuthProvider */}
    </div>
  );
};

export default Chats;
