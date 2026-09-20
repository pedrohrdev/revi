import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one remote dev database (no local stack —
    // see PLAN.md's "Sem Docker" note); running files in parallel would
    // let them race each other's fixtures/day-scoped uniqueness checks.
    fileParallelism: false,
    // Some integration tests make several sequential round-trips (admin
    // API calls, `supabase db query --linked` CLI shellouts) against a
    // real remote database — the 5s default is too tight for those.
    testTimeout: 30_000,
  },
});
