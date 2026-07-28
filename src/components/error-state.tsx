import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getErrorStatus,
  getErrorBucket,
  getMessage,
  type ErrorBucket,
} from "@/lib/error-status";

// Illustrations, one per bucket. These are resolved to hashed URLs by Vite at
// build time, so the images ship in the bundle. Drop the real artwork into
// src/images/errors/ using exactly these filenames.
import img1xx from "@/images/errors/1xx.png";
import img2xx from "@/images/errors/2xx.png";
import img3xx from "@/images/errors/3xx.png";
import img4xx from "@/images/errors/4xx.png";
import img5xx from "@/images/errors/5xx.png";
import imgSignalLost from "@/images/errors/signal-lost.png";

const BUCKET_IMAGE: Record<ErrorBucket, string> = {
  "1xx": img1xx,
  "2xx": img2xx,
  "3xx": img3xx,
  "4xx": img4xx,
  "5xx": img5xx,
  "signal-lost": imgSignalLost,
};

// Default copy per bucket. Callers can override `title`/`description`.
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
    description: "Our servers hit a problem. This is on us — please retry in a moment.",
  },
  "signal-lost": {
    title: "Signal lost",
    description: "We couldn't reach the server. Check your connection and try again.",
  },
};

type Variant = "page" | "block" | "inline";

const IMAGE_SIZE: Record<Variant, string> = {
  page: "h-48 w-48",
  block: "h-32 w-32",
  inline: "h-20 w-20",
};

const WRAP_PADDING: Record<Variant, string> = {
  page: "min-h-screen px-4 py-16",
  block: "py-10 px-4",
  inline: "py-6 px-4",
};

export interface ErrorStateProps {
  /** The thrown error. Its HTTP status (if any) picks the illustration. */
  error?: unknown;
  /**
   * Explicit status override. Use when you already know the code and aren't
   * passing an `error`. `null` forces the "signal lost" illustration.
   * Leave `undefined` to derive it from `error`.
   */
  status?: number | null;
  /** Retry handler — renders a "Try again" button when provided. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Override the auto-picked title. */
  title?: string;
  /** Override the message (defaults to the error's own message). */
  description?: string;
  /** Sizing preset. `page` = full-screen, `block` = card, `inline` = table cell. */
  variant?: Variant;
  className?: string;
}

/**
 * Central error display: shows the illustration for the error's HTTP-status
 * bucket (1xx…5xx or "signal lost") plus the exact status code as a number.
 *
 * Every "failed to load" / error-boundary surface in the app should render this
 * instead of hand-rolling its own icon + text, so the experience is consistent.
 */
export function ErrorState({
  error,
  status,
  onRetry,
  retryLabel = "Try again",
  title,
  description,
  variant = "block",
  className,
}: ErrorStateProps) {
  // `status === undefined` means "derive from error"; `status === null` means
  // "force signal lost". This lets callers be explicit either way.
  const resolvedStatus = status !== undefined ? status : getErrorStatus(error);
  const bucket = getErrorBucket(resolvedStatus);
  const copy = BUCKET_COPY[bucket];

  const heading = title ?? copy.title;
  const body = description ?? (getMessage(error) || copy.description);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
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

      {/* The status code as a prominent number — or a "Signal lost" label. */}
      {resolvedStatus != null ? (
        <span
          className={cn(
            "font-mono font-bold leading-none tracking-tight text-foreground",
            variant === "page" ? "text-5xl" : variant === "block" ? "text-4xl" : "text-2xl",
          )}
        >
          {resolvedStatus}
        </span>
      ) : (
        <span
          className={cn(
            "font-semibold uppercase tracking-widest text-muted-foreground",
            variant === "page" ? "text-lg" : "text-sm",
          )}
        >
          Signal lost
        </span>
      )}

      <div className="space-y-1">
        <p className={cn("font-semibold", variant === "page" ? "text-xl" : "text-sm")}>
          {heading}
        </p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground sm:text-sm">{body}</p>
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
