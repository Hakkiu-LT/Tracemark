import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyableId({ id, length = 8 }: { id: string; length?: number }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs text-muted-foreground" title={id}>
        {id.slice(0, length)}…
      </span>
      <button
        onClick={copy}
        title={copied ? "Copied!" : "Copy ID"}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
