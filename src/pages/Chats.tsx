import { useEffect, lazy, Suspense, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIncomingCallListener } from "@/hooks/useIncomingCallListener";
import ChatSidebar from "@/components/ChatSidebar";
import ChatEmptyState from "@/components/ChatEmptyState";
import DirectChat from "./DirectChat";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { IncomingCallOverlay } from "@/components/IncomingCallOverlay";
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
  
  // Global incoming call listener
  const { incomingCall, acceptCall, declineCall } = useIncomingCallListener(user?.id);
  
  // Check if we're on a chat subpage
  const isDirectChat = location.pathname.startsWith("/chat/");
  const isGroupChat = location.pathname.startsWith("/group/");
  const isOnChatPage = isDirectChat || isGroupChat;
  
  // Get the active conversation ID from the URL
  const activeConversationId = params.id;

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-collapsed', String(newValue));
      return newValue;
    });
  };

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
      return <DirectChat />;
    }
    if (isGroupChat) {
      return (
        <Suspense fallback={
          <div className="h-full flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <GroupChat />
        </Suspense>
      );
    }
    return <ChatEmptyState />;
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Sidebar - Conversations List (Desktop) */}
      <div className={`${isSidebarCollapsed ? 'w-[72px]' : 'w-[400px]'} flex-shrink-0 border-r border-border hidden md:block transition-all duration-300`}>
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

      {/* Right Side - Chat Area (Desktop only) */}
      <div className="flex-1 hidden md:flex flex-col">
        {renderChatContent()}
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
