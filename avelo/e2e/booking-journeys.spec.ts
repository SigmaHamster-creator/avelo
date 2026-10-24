import { test, expect, type Page } from "@playwright/test";

async function loadScenario(page: Page, label: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo controls" }).click();
  await page.getByLabel("Demo scenario").selectOption({ label });
  await page.getByRole("button", { name: "Load Example Data" }).click();
  await expect(page).toHaveURL(/\/booking$/);
}

test.describe("Avelo caregiver journeys (AC-DEMO-02/03/04, AC-BOOKING-01, AC-PRICE-01)", () => {
  test("Standard Arrangement: estimate -> auto-confirmation -> arrangement details", async ({ page }) => {
    await loadScenario(page, "Standard Arrangement");

    await page.getByRole("button", { name: "Review Estimate" }).click();
    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByText("Round-trip total:")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Request Arrangement" }).click();
    await expect(page).toHaveURL(/\/(status|arrangement)\//, { timeout: 10000 });

    // Same-price acceptance auto-confirms with no extra approval click (AC-BOOKING-01).
    await expect(page).toHaveURL(/\/arrangement\//, { timeout: 10000 });
    await expect(page.getByText("Arrangement Details")).toBeVisible();
    await expect(page.getByText("Pioneer Valley Rides")).toBeVisible();
  });

  test("Special Request / Price Revision: accept-new-price path confirms (AC-PRICE-01/02)", async ({ page }) => {
    await loadScenario(page, "Special Request / Price Revision");

    await page.getByRole("button", { name: "Review Estimate" }).click();
    await expect(page.getByText(/may not include additional costs for special requests/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Request Arrangement" }).click();
    await expect(page.getByText("Price Update: Action Required")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Difference: \+\$15\.00/)).toBeVisible();

    await page.getByRole("button", { name: "Accept New Price and Confirm" }).click();
    await expect(page).toHaveURL(/\/arrangement\//, { timeout: 10000 });
  });

  test("Special Request / Price Revision: Find Another Option resumes searching and still reaches Confirmed", async ({ page }) => {
    await loadScenario(page, "Special Request / Price Revision");
    await page.getByRole("button", { name: "Review Estimate" }).click();
    await page.getByRole("button", { name: "Request Arrangement" }).click();
    await expect(page.getByText("Price Update: Action Required")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Find Another Option" }).click();

    // Second attempt is re-offered at the original price, per the documented fixture.
    await expect(page).toHaveURL(/\/arrangement\//, { timeout: 10000 });
  });

  test("Replacement: request a different arrangement from a confirmed booking (AC-DEMO-04)", async ({ page }) => {
    await loadScenario(page, "Replacement");
    await page.getByRole("button", { name: "Review Estimate" }).click();
    await page.getByRole("button", { name: "Request Arrangement" }).click();
    await expect(page).toHaveURL(/\/arrangement\//, { timeout: 10000 });
    await expect(page.getByText("Pioneer Valley Rides")).toBeVisible();

    await page.getByRole("button", { name: "Request a Different Arrangement" }).click();
    await page.getByLabel("Why would you like a different arrangement?").fill("Original provider's vehicle became unavailable.");
    await page.getByRole("button", { name: "Request Replacement" }).click();

    // The original confirmed arrangement remains visible while the replacement search runs.
    await expect(page.getByText(/arranging a replacement/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pioneer Valley Rides")).toBeVisible();

    await expect(page.getByText("Berkshire Accessible Transport")).toBeVisible({ timeout: 10000 });
  });

  test("Voice/text input: naming a hospital fills its address, and a follow-up only changes what it mentions (AC-VOICE-01)", async ({ page }) => {
    await page.goto("/booking");
    const describe = page.getByLabel(/describe your trip in your own words/i);
    const update = page.getByRole("button", { name: "Update form from text" });

    await describe.fill("She needs to arrive at Pine Valley Hospital by 10 a.m.");
    await update.click();
    await expect(page.getByLabel("Destination / Hospital")).toHaveValue("Pine Valley Hospital");
    await expect(page.getByLabel("Destination Address", { exact: true })).toHaveValue("40 Valley View Drive, Northampton, MA");
    await expect(page.getByLabel("Required Arrival Time")).toHaveValue("10:00");

    await page.getByLabel("Passenger Name").fill("Walter Daniels");
    await describe.fill("Pick her up from the hospital at 4 p.m.");
    await update.click();
    await expect(page.getByLabel("Return Pickup Time")).toHaveValue("16:00");
    await expect(page.getByLabel("Required Arrival Time")).toHaveValue("10:00");
    await expect(page.getByLabel("Passenger Name")).toHaveValue("Walter Daniels");
    await expect(page.getByLabel("Destination Address", { exact: true })).toHaveValue("40 Valley View Drive, Northampton, MA");
  });

  test("Reset clears the form and a repeated run behaves identically (AC-DEMO-01)", async ({ page }) => {
    await loadScenario(page, "Standard Arrangement");
    await expect(page.getByLabel("Your Name")).toHaveValue("Rose Daniels");

    // The Demo Controls drawer is already open from loadScenario() above.
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    await page.goto("/booking");
    await expect(page.getByLabel("Your Name")).toHaveValue("");

    // Repeating the same scenario reproduces the same fixture data.
    await loadScenario(page, "Standard Arrangement");
    await expect(page.getByLabel("Your Name")).toHaveValue("Rose Daniels");
  });
});
