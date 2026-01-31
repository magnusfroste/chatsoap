import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransformationsMenu } from "./TransformationsMenu";

interface TransformationQuickActionProps {
  content: string;
  onResult: (result: string, transformationName: string) => void;
  onManage?: () => void;
  className?: string;
}

export function TransformationQuickAction({
  content,
  onResult,
  onManage,
  className = "",
}: TransformationQuickActionProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TransformationsMenu
        content={content}
        onResult={onResult}
        onManage={onManage}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </Button>
        }
      />
    </div>
  );
}
