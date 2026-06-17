import { useRef, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReviewState = "accepted" | "disputed" | null;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  /** Heading shown in the hover tooltip (falls back to label). */
  title?: string;
  /** Infraction detail shown in the hover tooltip. */
  description?: string;
}

interface BoundingBoxOverlayProps {
  src: string;
  alt?: string;
  boxes: Box[];
  className?: string;
  reviews?: Record<number, ReviewState>;
  onReview?: (idx: number, val: "accepted" | "disputed") => void;
}

const ACCEPTED_COLOR = "#22c55e";
const DISPUTED_COLOR = "#9ca3af";

function strokeFor(box: Box, review: ReviewState) {
  if (review === "accepted") return ACCEPTED_COLOR;
  if (review === "disputed") return DISPUTED_COLOR;
  return box.color;
}

export function BoundingBoxOverlay({
  src,
  alt = "Evidence Screenshot",
  boxes,
  className,
  reviews,
  onReview,
}: BoundingBoxOverlayProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const open = (idx: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(idx);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(null), 120);
  };

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <img src={src} alt={alt} className="w-full object-cover object-top opacity-90" />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Diagonal hatch (\) shown on the background of disputed boxes */}
          <pattern
            id="hatch-disputed"
            width="2.5"
            height="2.5"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0,0 L2.5,2.5" stroke={DISPUTED_COLOR} strokeWidth="0.4" />
          </pattern>
        </defs>
        {boxes.map((b, i) => {
          const review = reviews?.[i] ?? null;
          const color = strokeFor(b, review);
          const isHovered = hovered === i;
          const isAccepted = review === "accepted";
          const isDisputed = review === "disputed";
          const fillOpacity = isAccepted ? (isHovered ? 0.4 : 0.3) : isHovered ? 0.22 : 0.08;
          const strokeWidth = isAccepted ? "1.5" : isHovered ? "1" : "0.5";
          return (
            <g
              key={i}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => open(i)}
              onMouseLeave={scheduleClose}
            >
              {/* Transparent fill captures hover across the whole box area */}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={color}
                fillOpacity={fillOpacity}
              />
              {isDisputed && (
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill="url(#hatch-disputed)"
                />
              )}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      {hovered !== null && boxes[hovered] && (() => {
        const b = boxes[hovered];
        const review = reviews?.[hovered] ?? null;
        // Center the tooltip horizontally on the box (clamped so it stays
        // within the image bounds).
        const centerX = Math.min(Math.max(b.x + b.w / 2, 15), 85);
        // Flip the tooltip above the box when the box sits low in the image,
        // so it doesn't extend past the bottom edge and get clipped.
        const flipUp = b.y + b.h > 55;
        return (
          <div
            className="absolute z-30 w-60 -translate-x-1/2 rounded-md border border-border bg-popover text-popover-foreground shadow-xl p-3"
            style={{
              top: flipUp ? undefined : `${b.y + b.h + 1.5}%`,
              bottom: flipUp ? `${Math.max(100 - b.y + 1.5, 0)}%` : undefined,
              left: `${centerX}%`,
            }}
            onMouseEnter={() => open(hovered)}
            onMouseLeave={scheduleClose}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: strokeFor(b, review) }}
              />
              <h4 className="text-xs font-semibold text-foreground leading-tight">
                {b.title ?? b.label}
              </h4>
            </div>
            {b.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {b.description}
              </p>
            )}
            {onReview && (
              <div className="flex gap-1.5 mt-3">
                <Button
                  size="sm"
                  variant={review === "accepted" ? "default" : "outline"}
                  className="h-6 flex-1 text-xs px-2 gap-1"
                  onClick={() => onReview(hovered, "accepted")}
                >
                  <CheckCircle className="h-3 w-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant={review === "disputed" ? "destructive" : "outline"}
                  className="h-6 flex-1 text-xs px-2 gap-1"
                  onClick={() => onReview(hovered, "disputed")}
                >
                  <XCircle className="h-3 w-3" /> Dispute
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
