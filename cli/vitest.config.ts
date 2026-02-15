import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify("dev"),
    __VERSION__: JSON.stringify("0.0.0-test"),
  },
  test: {
    globals: true,
    testTimeout: 10000,
  },
});
