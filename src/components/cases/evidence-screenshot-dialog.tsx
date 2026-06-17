import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ExternalLink } from "lucide-react";

interface EvidenceScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshotUrl: string;
}

export function EvidenceScreenshotDialog({ open, onOpenChange, screenshotUrl }: EvidenceScreenshotDialogProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Evidence screenshot</DialogTitle>
        </DialogHeader>

        {!imgFailed ? (
          <img
            src={screenshotUrl}
            alt="Evidence screenshot"
            className="w-full rounded-md object-contain max-h-[80vh]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-muted-foreground">
            <p className="text-sm text-center">
              Screenshot could not be loaded inline.<br />
              Click below to open it in a new tab.
            </p>
            <Button asChild>
              <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open snapshot
              </a>
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            Close
          </Button>
          {!imgFailed && (
            <Button variant="outline" asChild>
              <a href={screenshotUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Download image
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
