import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test files are *.test.ts (plain logic, Node) and *.test.tsx (components: start the file with
// `// @vitest-environment jsdom`). tsconfig.json keeps `jsx: "preserve"` for Next.js, so esbuild is told how to turn JSX
// into code here. The "@/" alias is the same as in tsconfig.json.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // The default 5 s is too short for a full run in Docker on a laptop: component tests render many elements and a
    // test that passes alone can time out when 30 files run together.
    testTimeout: 20_000,
  },
});
