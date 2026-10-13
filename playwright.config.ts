import { defineConfig,devices } from "@playwright/test";

// PLAYWRIGHT_BASE_URL points the suite at an already running server (e.g. `pnpm start` in CI);
// without it Playwright starts the dev server itself.
const externalServer=process.env.PLAYWRIGHT_BASE_URL;
const baseURL=externalServer||"http://127.0.0.1:3000";

export default defineConfig({
  testDir:"./tests/e2e",
  timeout:30_000,
  use:{baseURL,trace:"retain-on-failure"},
  webServer:externalServer?undefined:{command:"pnpm dev",url:baseURL,reuseExistingServer:true,timeout:120_000},
  projects:[
    {name:"desktop",use:{...devices["Desktop Chrome"]}},
    {name:"mobile",use:{...devices["Pixel 7"]}},
  ],
});
