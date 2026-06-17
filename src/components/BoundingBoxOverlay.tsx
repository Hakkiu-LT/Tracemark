interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

interface BoundingBoxOverlayProps {
  src: string;
  alt?: string;
  boxes: Box[];
  className?: string;
}

export function BoundingBoxOverlay({ src, alt = "Evidence Screenshot", boxes, className }: BoundingBoxOverlayProps) {
  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <img src={src} alt={alt} className="w-full object-cover object-top opacity-90" />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={b.color}
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={b.x}
              y={b.y > 4 ? b.y - 4 : b.y + b.h}
              width={b.label.length * 1.5 + 2}
              height="4"
              fill={b.color}
              opacity="0.85"
            />
            <text
              x={b.x + 1}
              y={b.y > 4 ? b.y - 0.8 : b.y + b.h + 3.2}
              fill="white"
              fontSize="2.5"
              fontFamily="monospace"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
