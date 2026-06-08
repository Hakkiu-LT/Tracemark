import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";

interface EvidenceScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshotUrl: string;
}

export function EvidenceScreenshotDialog({ open, onOpenChange, screenshotUrl }: EvidenceScreenshotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Evidence screenshot</DialogTitle>
        </DialogHeader>
        <img src={screenshotUrl} alt="Evidence screenshot" className="w-full rounded-md object-contain max-h-[80vh]" />
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            Close
          </Button>
          <Button variant="outline" asChild>
            <a href={screenshotUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Download image
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
