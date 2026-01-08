import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Users, MessageSquare, Video, Sparkles } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-valhalla-deep via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-valhalla-purple/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-valhalla-gold/10 blur-[100px] rounded-full" />
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-12">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg gradient-valhalla flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">Silicon Valhalla</span>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")}
              className="border-primary/50 hover:border-primary hover:bg-primary/10"
            >
              Logga in
            </Button>
          </nav>

          {/* Hero content */}
          <div className="max-w-4xl mx-auto text-center pt-12 pb-24">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm mb-8">
              <Sparkles className="w-4 h-4 text-valhalla-gold" />
              <span className="text-muted-foreground">Invite-only AI Collaboration</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              Där <span className="gradient-valhalla-text">innovatörer</span> möts
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
              En exklusiv plattform för tech-ledare att samarbeta i realtid 
              med delad AI-arbetsyta. Tänk video + gemensam AI – inte skärmdelning.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="gradient-valhalla hover:opacity-90 glow-valhalla text-lg px-8"
              >
                Gå med nu
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-border hover:bg-card text-lg px-8"
              >
                Lär dig mer
              </Button>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto pb-20">
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="Video Collaboration"
              description="2-4 deltagare i HD-video, med presence och reaktioner i realtid."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="Delad AI-Arbetsyta"
              description="Alla ser och bidrar till samma AI-konversation. Tillsammans."
            />
            <FeatureCard
              icon={<Video className="w-6 h-6" />}
              title="AI Röstassistent"
              description="Prata direkt med AI:n. Alla i rummet hör svaren."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Silicon Valhalla Meet. Invite-only.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="glass-card rounded-xl p-6 hover:border-primary/30 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
