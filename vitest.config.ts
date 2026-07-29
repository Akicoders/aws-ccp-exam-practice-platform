import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/data/questions/index": path.resolve(__dirname, "./src/data/questions/index"),
      "@/data/explanations.json": path.resolve(__dirname, "./src/data/explanations.json"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
});
