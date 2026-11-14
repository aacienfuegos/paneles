import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { PANELES_DB: ":memory:" },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
