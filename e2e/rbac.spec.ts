import { expect, test, type Page } from "@playwright/test";

// Requires the full stack (docker compose up) with seed data.
const PASSWORD = "Password123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("admin can manage users end-to-end", async ({ page }) => {
  await login(page, "admin@timeflow.dev");
  await page.getByRole("link", { name: /users/i }).first().click();
  await page.getByRole("link", { name: /new user/i }).click();

  const email = `e2e.${Date.now()}@timeflow.dev`;
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Player");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill("Password123");
  await page.getByLabel("Role").click();
  await page.getByRole("option", { name: "Employee" }).click();
  await page.getByRole("button", { name: /create user/i }).click();

  await expect(page.getByRole("heading", { name: "E2E Player" })).toBeVisible();
});

test("employee cannot see user management", async ({ page }) => {
  await login(page, "employee@timeflow.dev");
  await expect(page.getByRole("navigation", { name: /main navigation/i }).getByRole("link", { name: /users/i })).toHaveCount(0);
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: /access denied/i })).toBeVisible();
});
