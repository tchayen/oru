import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { transformerMetaHighlight } from "@shikijs/transformers";
import rehypeWrap from "rehype-wrap-all";

export default defineConfig({
  // Preserve whitespace in terminal demo <pre>-like spans.
  compressHTML: false,
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    rehypePlugins: [[rehypeWrap, { selector: "table", wrapper: "div.table-wrap" }]],
    shikiConfig: {
      theme: "github-dark-default",
      transformers: [
        transformerMetaHighlight(),
        {
          // Add wrapper div with copy button support
          pre(node) {
            const meta = this.options.meta?.__raw || "";
            const showCopy = meta.includes("copy");

            // Wrap in mini-code-wrap div
            return {
              type: "element",
              tagName: "div",
              properties: {
                class: showCopy ? "mini-code-wrap has-copy" : "mini-code-wrap",
              },
              children: [node],
            };
          },
        },
      ],
    },
  },
});
