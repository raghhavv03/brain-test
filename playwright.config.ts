import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

// Minimal .env.local loader — avoids adding a dotenv dependency for what's
// three KEY=VALUE lines. NEXT_PUBLIC_* vars only, already public/client-
// bundled (§9e) — safe to read here for authenticated post-run REST checks.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

// This suite will grow to cover all 5 games + results + Supabase
// verification (~5-7 min for the full flow) — timeout and retries are sized
// for that end state now, not revisited per-game.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 300_000,
  retries: 0,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
