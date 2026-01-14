import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SendToNotesButtonProps {
  onClick: () => void;
  className?: string;
}

export const SendToNotesButton = ({
  onClick,
  className = "",
}: SendToNotesButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={`h-6 w-6 text-muted-foreground hover:text-primary ${className}`}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Save to notes</p>
      </TooltipContent>
    </Tooltip>
  );
};
