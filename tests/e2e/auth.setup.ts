import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { test as setup } from "@playwright/test";

import { signInAs } from "../helpers/auth";
import { ensureTestAdmin } from "../helpers/db";

const AUTH_FILE = "tests/.auth/admin.json";

setup("authenticate admin", async ({ page }) => {
  const credentials = await ensureTestAdmin();

  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await signInAs(page, { ...credentials, dest: "/admin" });
  await page.context().storageState({ path: AUTH_FILE });
});
