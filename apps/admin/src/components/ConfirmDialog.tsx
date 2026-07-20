import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button, Dialog } from "@/components/ui";

/**
 * useConfirm — a promise-free confirm dialog hook. Returns a trigger + the rendered
 * dialog element. Replaces window.confirm for destructive actions.
 *
 *   const confirm = useConfirm();
 *   ...
 *   <Button onClick={() => confirm.open({ title, onConfirm })}>Delete</Button>
 *   {confirm.element}
 */
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!opts) return;
    try {
      setBusy(true);
      await opts.onConfirm();
      setOpts(null);
    } finally {
      setBusy(false);
    }
  }

  const element: ReactNode = opts ? (
    <Dialog
      open
      onClose={() => !busy && setOpts(null)}
      title={opts.title}
      description={opts.description}
      footer={
        <>
          <Button variant="outline" onClick={() => setOpts(null)} disabled={busy}>Cancel</Button>
          <Button variant={opts.destructive ? "destructive" : "default"} onClick={run} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {opts.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    />
  ) : null;

  return { open: (o: ConfirmOptions) => setOpts(o), element };
}
