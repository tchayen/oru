/**
 * Custom Shiki theme matching oru's grayscale syntax highlighting.
 * Maps to CSS variables: --color-text-primary, --color-syn-* etc.
 */
export const oruTheme = {
  name: "oru",
  type: "dark",
  colors: {
    "editor.background": "#18181b", // --color-bg-inset
    "editor.foreground": "#a1a1aa", // --color-text-secondary
  },
  tokenColors: [
    // Commands (first word) - primary white
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#fafafa" }, // --color-text-primary
    },
    // Subcommands and arguments
    {
      scope: ["string", "string.unquoted", "meta.function-call.arguments"],
      settings: { foreground: "#e5e5e5" }, // --color-syn-command
    },
    // Flags/options
    {
      scope: ["variable.parameter", "punctuation.definition.parameter", "entity.name.tag"],
      settings: { foreground: "#a3a3a3" }, // --color-syn-flag
    },
    // Quoted strings
    {
      scope: ["string.quoted", "string.quoted.double", "string.quoted.single"],
      settings: { foreground: "#d4d4d4" }, // --color-syn-string
    },
    // Values
    {
      scope: ["constant", "constant.numeric", "constant.language"],
      settings: { foreground: "#c0c0c0" }, // --color-syn-value
    },
    // Comments
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#71717a" }, // --color-text-muted
    },
    // Operators and punctuation
    {
      scope: ["keyword.operator", "punctuation"],
      settings: { foreground: "#a1a1aa" }, // --color-text-secondary
    },
    // Keywords
    {
      scope: ["keyword", "storage"],
      settings: { foreground: "#a3a3a3" },
    },
    // Variables
    {
      scope: ["variable", "variable.other"],
      settings: { foreground: "#e5e5e5" },
    },
  ],
};
