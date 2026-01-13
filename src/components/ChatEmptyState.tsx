import { MessageSquare, Lock } from "lucide-react";

const ChatEmptyState = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-background p-8 relative">
      {/* WhatsApp-style pattern background */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative z-10 text-center max-w-md">
        {/* Icon */}
        <div className="w-72 h-72 mx-auto mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl" />
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
              <MessageSquare className="w-16 h-16 text-primary/60" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-light text-foreground mb-4">
          Silicon Valhalla Meet
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Skicka och ta emot meddelanden utan att behöva ha telefonen ansluten.
          <br />
          Välj en chatt från listan till vänster för att börja.
        </p>

        {/* Encryption notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>Dina personliga meddelanden är säkra</span>
        </div>
      </div>
    </div>
  );
};

export default ChatEmptyState;
