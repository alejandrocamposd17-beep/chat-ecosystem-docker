import { defineConfig } from "@playwright/test";

// El ecosistema completo (docker compose up) debe estar corriendo en BASE_URL
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // En CI el primer arranque de Next.js puede tardar: un reintento evita falsos negativos
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
