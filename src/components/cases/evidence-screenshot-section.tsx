import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EvidenceScreenshotDialog } from "@/components/cases/evidence-screenshot-dialog";
import { Download } from "lucide-react";

export function EvidenceScreenshotSection({ screenshotUrl }: { screenshotUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <EvidenceScreenshotDialog open={open} onOpenChange={setOpen} screenshotUrl={screenshotUrl} />

      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evidence</p>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity cursor-zoom-in"
      >
        <img src={screenshotUrl} alt="Evidence screenshot" className="w-full object-cover max-h-36" />
      </button>
      <p className="text-xs text-muted-foreground">
        A screenshot is available for this platform. Attach it to strengthen your submission.
      </p>
      <Button variant="outline" size="sm" className="w-full" asChild>
        <a href={screenshotUrl} download>
          <Download className="h-3.5 w-3.5 mr-2" />
          Download image
        </a>
      </Button>
    </div>
  );
}
