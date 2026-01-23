import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".expo"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/types/**",
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
