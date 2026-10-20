import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/api/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
});
