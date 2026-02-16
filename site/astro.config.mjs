import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Preserve whitespace in terminal demo <pre>-like spans.
  compressHTML: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
