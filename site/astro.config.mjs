import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { transformerMetaHighlight } from "@shikijs/transformers";
import rehypeWrap from "rehype-wrap-all";
import { oruTheme } from "./src/shiki-theme.mjs";

export default defineConfig({
  // Preserve whitespace in terminal demo <pre>-like spans.
  compressHTML: false,
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    rehypePlugins: [[rehypeWrap, { selector: "table", wrapper: "div.table-wrap" }]],
    shikiConfig: {
      theme: oruTheme,
      transformers: [
        transformerMetaHighlight(),
        {
          // Remove newline text nodes between lines
          code(node) {
            node.children = node.children.filter(
              (child) => !(child.type === "text" && child.value.trim() === ""),
            );
          },
        },
        {
          name: "add-prompt",
          // Add $ prompt to bash lines
          line(node) {
            const lang = this.options.lang;
            if (lang === "bash" || lang === "sh" || lang === "shell") {
              node.children.unshift({
                type: "element",
                tagName: "span",
                properties: { class: "prompt" },
                children: [{ type: "text", value: "$ " }],
              });
            }
          },
        },
        {
          // Add wrapper div with copy button support
          pre(node) {
            const meta = this.options.meta?.__raw || "";
            const showCopy = meta.includes("copy");

            const children = [node];

            if (showCopy) {
              // Add copy button
              children.push({
                type: "element",
                tagName: "button",
                properties: {
                  class:
                    "mini-code-copy copy-btn flex items-center justify-center rounded-md text-text-muted transition-all duration-150 cursor-pointer hover:text-text-secondary hover:bg-white/5",
                  "data-copy-code": true,
                  "aria-label": "Copy",
                  type: "button",
                },
                children: [
                  {
                    type: "element",
                    tagName: "svg",
                    properties: {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "rect",
                        properties: { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" },
                        children: [],
                      },
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
                        },
                        children: [],
                      },
                    ],
                  },
                ],
              });
            }

            // Wrap in mini-code-wrap div
            return {
              type: "element",
              tagName: "div",
              properties: {
                class: showCopy ? "mini-code-wrap has-copy" : "mini-code-wrap",
              },
              children,
            };
          },
        },
      ],
    },
  },
});
