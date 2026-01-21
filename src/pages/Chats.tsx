import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIncomingCallListener } from "@/hooks/useIncomingCallListener";
import { useCAGContext } from "@/hooks/useCAGContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatEmptyState from "@/components/ChatEmptyState";
import DirectChat from "./DirectChat";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { IncomingCallOverlay } from "@/components/IncomingCallOverlay";
import { WorkspaceCanvas, CanvasApp } from "@/components/WorkspaceCanvas";
import { canvasEventBus } from "@/lib/canvas-apps";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Loader2 } from "lucide-react";

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
  const [isCanvasVisible, setIsCanvasVisible] = useState(() => {
    const saved = localStorage.getItem('canvas-visible');
    return saved !== 'false'; // Default to visible
  });
  const [canvasActiveTab, setCanvasActiveTab] = useState<CanvasApp>(() => {
    const saved = localStorage.getItem('workspace-canvas-app');
    return (saved as CanvasApp) || "notes";
  });
  
  // Global incoming call listener
  const { incomingCall, acceptCall, declineCall } = useIncomingCallListener(user?.id);
  
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

  const handleOpenFilesTab = useCallback(() => {
    setCanvasActiveTab("files");
  }, []);

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
          onOpenFiles={handleOpenFilesTab}
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
            onOpenFiles={handleOpenFilesTab}
          />
        </Suspense>
      );
    }
    return <ChatEmptyState />;
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Sidebar - Conversations List (Desktop) */}
      <div className={`${isSidebarCollapsed ? 'w-[72px]' : 'w-[320px]'} flex-shrink-0 border-r border-border hidden md:block transition-all duration-300 overflow-hidden`}>
        <ChatSidebar 
          activeConversationId={activeConversationId} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      </div>

      {/* Mobile: Show only sidebar if not on chat page */}
      <div className="w-full md:hidden">
        {!isOnChatPage ? (
          <ChatSidebar activeConversationId={activeConversationId} />
        ) : (
          renderChatContent()
        )}
      </div>

      {/* Desktop: Middle Chat + Right Canvas with Resizable Panels */}
      <div className="flex-1 hidden md:flex">
        <ResizablePanelGroup direction="horizontal">
          {/* Middle - Chat Area */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="h-full flex flex-col">
              {renderChatContent()}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right - Canvas/Workspace */}
          <ResizablePanel defaultSize={55} minSize={35}>
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
        </ResizablePanelGroup>
      </div>

      {/* Notification Permission Banner */}
      <NotificationPermissionBanner />

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <IncomingCallOverlay
          call={incomingCall}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}
    </div>
  );
};

export default Chats;
