import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Only TEST_DATABASE_URL is passed through, so tests can never reach DATABASE_URL.
const local: Record<string, string> = {};
config({ path: ".env.local", processEnv: local, quiet: true });
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: testDatabaseUrl ? { TEST_DATABASE_URL: testDatabaseUrl } : {},
  },
});
