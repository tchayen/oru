import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify("dev"),
  },
  test: {
    globals: true,
    testTimeout: 10000,
  },
});
