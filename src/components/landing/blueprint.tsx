/**
 * Decorative blueprint construction lines for the technical-paper sections.
 * One absolute SVG per section, always `aria-hidden`. Each variant moves its
 * guide lines and crosshair so they relate to that section's real layout — the
 * lines never sit under paragraphs, buttons, or form labels. Rendered with
 * `vectorEffect="non-scaling-stroke"` so the hairlines stay crisp at any size.
 */

import type { ReactElement } from "react";

type Variant = "hero" | "proof" | "coverage" | "how" | "architecture" | "cta";

const PATHS: Record<Variant, ReactElement> = {
  // Frame + centered crosshair emphasizing the hero column and CTA group.
  hero: (
    <g fill="none">
      <path d="M48 96H1392M48 812H1392" />
      <path d="M96 48V860M1344 48V860" />
      <path d="M82 96h28M96 82v28M1330 812h28M1344 798v28" />
      <circle cx="720" cy="300" r="13" />
      <path d="M698 300h44M720 278v44" />
    </g>
  ),
  // Guides aligned to the evidence columns and monitoring rows.
  proof: (
    <g fill="none">
      <path d="M64 120H1376" />
      <path d="M864 120V820" />
      <path d="M64 480H1376" />
      <path d="M64 106v28M1376 106v28" />
    </g>
  ),
  // Sparse contour ticks near the outer margins of the dark map surface.
  coverage: (
    <g fill="none">
      <path d="M72 110H1368M72 806H1368" />
      <path d="M120 110V806M1320 110V806" />
      <circle cx="120" cy="110" r="10" />
      <circle cx="1320" cy="806" r="10" />
    </g>
  ),
  // Horizontal process datum with three station markers for the 3 steps.
  how: (
    <g fill="none">
      <path d="M96 470H1344" />
      <path d="M336 456v28M720 456v28M1104 456v28" />
      <circle cx="336" cy="470" r="7" />
      <circle cx="720" cy="470" r="7" />
      <circle cx="1104" cy="470" r="7" />
    </g>
  ),
  // Module boundaries + connector routes framing the central engine.
  architecture: (
    <g fill="none">
      <path d="M64 130H1376M64 780H1376" />
      <path d="M720 130V780" />
      <circle cx="720" cy="455" r="16" />
      <path d="M690 455h60M720 425v60" />
    </g>
  ),
  // Quiet construction lines behind the dark conversion message.
  cta: (
    <g fill="none">
      <path d="M80 120H1360M80 780H1360" />
      <path d="M480 120V780M960 120V780" />
      <path d="M66 120h28M1346 780h28" />
    </g>
  ),
};

export function BlueprintOverlay({ variant }: { variant: Variant }) {
  return (
    <svg
      aria-hidden="true"
      className="blueprint-overlay"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
    >
      {PATHS[variant]}
    </svg>
  );
}
