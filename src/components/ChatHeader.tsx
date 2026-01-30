import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Bot, Users, Phone, Video } from "lucide-react";
import { ChatActionsMenu } from "@/components/ChatActionsMenu";
import { ChatMessageSearch } from "@/components/ChatMessageSearch";
import { PersonaSwitcher, AI_PERSONAS } from "@/components/PersonaSwitcher";
import { InlineCallBar } from "@/components/InlineCallBar";
import { CallStatus, CallType } from "@/hooks/useDirectCall";

interface TypingUser {
  id: string;
  display_name: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  is_ai: boolean;
  profile?: {
    display_name: string | null;
  };
}

// Direct chat specific props
interface DirectChatInfo {
  type: "direct" | "ai_chat";
  persona?: string | null;
  personaName?: string | null;
  customSystemPrompt?: string | null;
  other_user?: {
    id: string;
    display_name: string;
  };
}

// Group chat specific props
interface GroupChatInfo {
  type: "group";
  name: string | null;
  members: Array<{ user_id: string; display_name: string }>;
}

// Call state for direct calls
interface DirectCallState {
  status: CallStatus;
  callType: CallType;
  isIncoming?: boolean;
  remoteUserName?: string | null;
}

interface ChatHeaderBaseProps {
  conversationId: string;
  userId: string | undefined;
  messages: Message[];
  typingUsers: TypingUser[];
  aiTyping?: boolean;
  onHighlightMessage: (messageId: string | null) => void;
  onDeleted: () => void;
}

interface DirectChatHeaderProps extends ChatHeaderBaseProps {
  variant: "direct";
  conversation: DirectChatInfo | null;
  onPersonaChange?: (persona: string | null, customSystemPrompt?: string) => void;
  // Call-related props
  callState?: DirectCallState;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  onStartCall?: (type: "audio" | "video") => void;
  onEndCall?: () => void;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
}

interface GroupChatHeaderProps extends ChatHeaderBaseProps {
  variant: "group";
  group: GroupChatInfo | null;
  inCall?: boolean;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
}

type ChatHeaderProps = DirectChatHeaderProps | GroupChatHeaderProps;

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const ChatHeader = (props: ChatHeaderProps) => {
  const navigate = useNavigate();

  const {
    conversationId,
    userId,
    messages,
    typingUsers,
    onHighlightMessage,
    onDeleted,
  } = props;

  // Render avatar based on variant
  const renderAvatar = () => {
    if (props.variant === "group") {
      return (
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-medium">
            <Users className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      );
    }

    const { conversation } = props;
    const isAIChat = conversation?.type === "ai_chat";

    return (
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className={`font-medium ${
            isAIChat
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
              : "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground"
          }`}
        >
          {isAIChat ? (
            <Bot className="w-5 h-5" />
          ) : conversation?.other_user ? (
            getInitials(conversation.other_user.display_name)
          ) : (
            "?"
          )}
        </AvatarFallback>
      </Avatar>
    );
  };

  // Render title and subtitle
  const renderTitleSection = () => {
    if (props.variant === "group") {
      const { group } = props;
      const memberNames = group?.members.map((m) => m.display_name).join(", ") || "";

      return (
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-foreground truncate">
            {group?.name || "Grupp"}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {typingUsers.length > 0
              ? `${typingUsers.map((u) => u.display_name).join(", ")} skriver...`
              : memberNames}
          </p>
        </div>
      );
    }

    const { conversation, aiTyping, onPersonaChange } = props;
    const isAIChat = conversation?.type === "ai_chat";

    // Get display name for AI chat
    const getAIChatName = () => {
      if (conversation?.personaName) return conversation.personaName;
      const builtIn = AI_PERSONAS.find((p) => p.id === conversation?.persona);
      return builtIn?.name || "AI Assistent";
    };

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-foreground truncate">
            {isAIChat
              ? getAIChatName()
              : conversation?.other_user?.display_name || "Chatt"}
          </h1>
          {isAIChat && onPersonaChange && (
            <PersonaSwitcher
              conversationId={conversationId}
              currentPersona={conversation?.persona}
              onPersonaChange={onPersonaChange}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isAIChat
            ? aiTyping
              ? "skriver..."
              : "redo att hjälpa"
            : typingUsers.length > 0
            ? "skriver..."
            : "online"}
        </p>
      </div>
    );
  };

  // Render action buttons
  const renderActions = () => {
    if (props.variant === "group") {
      const { group, inCall, onJoinCall, onLeaveCall } = props;

      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`text-muted-foreground hover:text-foreground ${
              inCall ? "text-destructive" : ""
            }`}
            onClick={inCall ? onLeaveCall : onJoinCall}
          >
            <Video className="w-5 h-5" />
          </Button>
          <ChatMessageSearch
            messages={messages}
            onHighlightMessage={onHighlightMessage}
          />
          <ChatActionsMenu
            conversationId={conversationId}
            userId={userId}
            chatName={group?.name || "Grupp"}
            onDeleted={onDeleted}
          />
        </div>
      );
    }

    const {
      conversation,
      callState,
      localStream,
      remoteStream,
      audioEnabled,
      videoEnabled,
      onStartCall,
      onEndCall,
      onToggleAudio,
      onToggleVideo,
    } = props;

    const isAIChat = conversation?.type === "ai_chat";
    const showCallBar =
      callState?.status !== "idle" &&
      !(callState?.status === "ringing" && callState?.isIncoming) &&
      callState?.callType === "audio" &&
      !videoEnabled;

    return (
      <div className="flex items-center gap-1">
        {/* Inline call bar for audio calls */}
        {showCallBar && callState && onEndCall && onToggleAudio && onToggleVideo && (
          <InlineCallBar
            status={callState.status}
            callType={callState.callType}
            remoteUserName={callState.remoteUserName}
            localStream={localStream}
            remoteStream={remoteStream}
            audioEnabled={audioEnabled}
            onEnd={onEndCall}
            onToggleAudio={onToggleAudio}
            onExpandToVideo={onToggleVideo}
          />
        )}

        {/* Call buttons - only show when not in a call and not AI chat */}
        {!isAIChat && callState?.status === "idle" && onStartCall && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onStartCall("video")}
            >
              <Video className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onStartCall("audio")}
            >
              <Phone className="w-5 h-5" />
            </Button>
          </>
        )}

        <ChatMessageSearch
          messages={messages}
          onHighlightMessage={onHighlightMessage}
        />
        <ChatActionsMenu
          conversationId={conversationId}
          userId={userId}
          chatName={conversation?.other_user?.display_name || "Chatt"}
          onDeleted={onDeleted}
        />
      </div>
    );
  };

  return (
    <header className="flex-shrink-0 bg-card border-b border-border px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Mobile back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/chats")}
          className="md:hidden text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {renderAvatar()}
        {renderTitleSection()}
        {renderActions()}
      </div>
    </header>
  );
};
