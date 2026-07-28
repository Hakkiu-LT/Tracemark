import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  getErrorStatus,
  getErrorBucket,
  getMessage,
  type ErrorBucket,
} from "@/lib/error-status";

// Illustrations live in apps/admin/public/errors/ and are served at /errors/*.
// The filename maps to the HTTP-status bucket; the exact code is shown as text.
const BUCKET_IMAGE: Record<ErrorBucket, string> = {
  "1xx": "/errors/1xx.png",
  "2xx": "/errors/2xx.png",
  "3xx": "/errors/3xx.png",
  "4xx": "/errors/4xx.png",
  "5xx": "/errors/5xx.png",
  "signal-lost": "/errors/signal-lost.png",
};

const BUCKET_COPY: Record<ErrorBucket, { title: string; description: string }> = {
  "1xx": {
    title: "Still processing",
    description: "The server is taking longer than expected to respond.",
  },
  "2xx": {
    title: "Unexpected response",
    description: "The server responded, but the data couldn't be read.",
  },
  "3xx": {
    title: "Redirected",
    description: "The request was redirected and couldn't be completed.",
  },
  "4xx": {
    title: "Request couldn't be completed",
    description: "Something about this request wasn't accepted. Please try again.",
  },
  "5xx": {
    title: "Server error",
    description: "The admin API hit a problem. Please retry in a moment.",
  },
  "signal-lost": {
    title: "Signal lost",
    description: "We couldn't reach the admin API. Check your connection and try again.",
  },
};

type Variant = "page" | "block" | "inline";

const IMAGE_SIZE: Record<Variant, string> = {
  page: "h-40 w-40",
  block: "h-28 w-28",
  inline: "h-20 w-20",
};

const WRAP_PADDING: Record<Variant, string> = {
  page: "min-h-[60vh] px-4 py-16",
  block: "py-8 px-4",
  inline: "py-6 px-4",
};

export interface ErrorStateProps {
  /** The thrown error. Its HTTP status (if any) picks the illustration. */
  error?: unknown;
  /**
   * Explicit status override. `null` forces "signal lost". Leave `undefined`
   * to derive it from `error`.
   */
  status?: number | null;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
  description?: string;
  variant?: Variant;
  className?: string;
}

/**
 * Central error display for the admin portal: shows the illustration for the
 * error's HTTP-status bucket (1xx…5xx or "signal lost") plus the exact status
 * code as a number. Mirrors the customer app's `<ErrorState>`.
 */
export function ErrorState({
  error,
  status,
  onRetry,
  retryLabel = "Retry",
  title,
  description,
  variant = "block",
  className,
}: ErrorStateProps) {
  const resolvedStatus = status !== undefined ? status : getErrorStatus(error);
  const bucket = getErrorBucket(resolvedStatus);
  const copy = BUCKET_COPY[bucket];

  const heading = title ?? copy.title;
  const body = description ?? (getMessage(error) || copy.description);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        WRAP_PADDING[variant],
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <img
        src={BUCKET_IMAGE[bucket]}
        alt={resolvedStatus != null ? `Error ${resolvedStatus}` : "Connection lost"}
        className={cn("select-none object-contain", IMAGE_SIZE[variant])}
        draggable={false}
      />

      {resolvedStatus != null ? (
        <span
          className={cn(
            "font-mono font-bold leading-none tracking-tight text-foreground",
            variant === "page" ? "text-5xl" : variant === "block" ? "text-3xl" : "text-2xl",
          )}
        >
          {resolvedStatus}
        </span>
      ) : (
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Signal lost
        </span>
      )}

      <div className="space-y-1">
        <p className={cn("font-semibold", variant === "page" ? "text-lg" : "text-sm")}>{heading}</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">{body}</p>
      </div>

      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
