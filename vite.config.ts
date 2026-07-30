// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      // Keep the marketplace/platform logos (Amazon, eBay, …) as external files
      // instead of base64 data-URIs. The Coverage marquee repeats each logo chip
      // several times, so an inlined logo would embed the full base64 blob on
      // every duplicate in the SSR HTML. As external assets the browser fetches
      // and caches one small file and the HTML holds only a short URL.
      // Everything else falls back to Vite's default 4KB inline threshold.
      assetsInlineLimit: (filePath: string) =>
        filePath.includes("/images/platforms/") ? false : undefined,
    },
  },
});
