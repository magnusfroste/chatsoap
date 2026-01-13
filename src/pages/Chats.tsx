import { useEffect, lazy, Suspense } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ChatSidebar from "@/components/ChatSidebar";
import ChatEmptyState from "@/components/ChatEmptyState";
import DirectChat from "./DirectChat";
import { Loader2 } from "lucide-react";

// Lazy load GroupChat
const GroupChat = lazy(() => import("./GroupChat"));

const Chats = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  
  // Check if we're on a chat subpage
  const isDirectChat = location.pathname.startsWith("/chat/");
  const isGroupChat = location.pathname.startsWith("/group/");
  const isOnChatPage = isDirectChat || isGroupChat;
  
  // Get the active conversation ID from the URL
  const activeConversationId = params.id;

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
      <div className="w-[400px] flex-shrink-0 border-r border-border hidden md:block">
        <ChatSidebar activeConversationId={activeConversationId} />
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
    </div>
  );
};

export default Chats;
