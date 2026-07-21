import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  // Read the single shared .env at the repo root (VITE_* only are exposed to the client).
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  server: {
    port: 8082,
    host: true,
  },
});
