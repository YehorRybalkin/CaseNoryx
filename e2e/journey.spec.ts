import { expect, test, type Page } from "@playwright/test";

const SLUG = "retail-profitability";

/** Navigate and wait until the client has hydrated (network idle). */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function fillSection(page: Page, id: string, text: string) {
  await page.locator(`#rec-${id}`).fill(text);
}

test.describe.serial("complete consulting journey (offline, no API key)", () => {
  test("new user sees onboarding and empty states", async ({ page }) => {
    await go(page, "/");
    await expect(page.getByRole("heading", { name: /Welcome to CaseNoryx/ })).toBeVisible();
    await expect(page.getByText("No evaluations yet").first()).toBeVisible();
    await expect(page.getByText("Get started in four steps")).toBeVisible();
    await go(page, "/performance");
    await expect(page.getByText("No evaluated submissions yet")).toBeVisible();
  });

  test("select a case from the library and read the brief", async ({ page }) => {
    await go(page, "/cases");
    await expect(page.locator("[data-testid^=case-card-]")).toHaveCount(5);
    await page.getByTestId(`case-card-${SLUG}`).getByRole("link", { name: /Start/ }).click();
    await expect(page.getByRole("heading", { name: "Retail Profitability Crisis" })).toBeVisible();
    await expect(page.getByText("Problem statement")).toBeVisible();
    await expect(page.getByText("Revenue increased, but operating profit declined significantly", { exact: false })).toBeVisible();
  });

  test("explore data: filter, search, sort and export CSV", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=data`);
    await expect(page.getByText("480 of 480 rows")).toBeVisible();
    await page.locator("#seg-category").selectOption("Electronics");
    await expect(page.getByText("96 of 480 rows")).toBeVisible();
    await page.locator("#seg-region").selectOption("South");
    await expect(page.getByText("24 of 480 rows")).toBeVisible();
    await page.locator("#ds-from").selectOption("2024-01");
    await expect(page.getByText("12 of 480 rows")).toBeVisible();
    await page.getByRole("button", { name: /Avg. selling price/ }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`casenoryx-${SLUG}-sales.csv`);
    await expect(page.getByText("Exported 12 rows to CSV")).toBeVisible();
    // Search across columns
    await page.locator("#seg-category").selectOption("");
    await page.locator("#seg-region").selectOption("");
    await page.locator("#ds-from").selectOption("");
    await page.locator("#ds-search").fill("Beauty");
    await expect(page.getByText("96 of 480 rows")).toBeVisible();
  });

  test("analytics filters change the analysis", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=analytics`);
    const kpi = page.getByText("Net sales FY2024").locator("..");
    await expect(kpi).toContainText("€297.2m");
    await page.locator("#r-region").selectOption("North");
    await expect(kpi).not.toContainText("€297.2m");
    await expect(page.getByText("Operating expenses are only available at group level")).toBeVisible();
  });

  test("create a hypothesis and it persists after reload", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=hypotheses`);
    await expect(page.getByText("No hypotheses yet")).toBeVisible();
    await page.getByRole("button", { name: "Add your first hypothesis" }).click();
    await page.getByLabel("Title").fill("Electronics discounting compressed gross margin");
    await page.getByLabel("Supporting evidence").fill("Electronics GM 21.6% → 11.0%; price −8%");
    await page.getByLabel("Status").selectOption("supported");
    await page.getByRole("button", { name: "Save hypothesis" }).click();
    await expect(page.getByText("Hypothesis created")).toBeVisible();
    await page.getByRole("button", { name: "New hypothesis" }).click();
    await page.getByLabel("Title").fill("East region is structurally weak");
    await page.getByLabel("Status").selectOption("contradicted");
    await page.getByRole("button", { name: "Save hypothesis" }).click();
    await page.reload();
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("hypothesis-list");
    await expect(list.getByText("Electronics discounting compressed gross margin")).toBeVisible();
    await expect(list.getByText("Supported")).toBeVisible();
    await expect(list.getByText("Contradicted")).toBeVisible();
  });

  test("adjust and save a scenario", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=scenario`);
    const op = page.getByTestId("scenario-operatingProfit");
    const before = await op.textContent();
    await page.locator("#lever-elecCost").fill("5");
    await expect(op).not.toHaveText(before ?? "");
    await page.getByLabel("Scenario name").fill("Supplier renegotiation");
    await page.getByRole("button", { name: "Save scenario" }).click();
    await expect(page.getByText("Saved scenario “Supplier renegotiation”")).toBeVisible();
    await go(page, "/simulator?case=" + SLUG);
    await expect(page.getByText("Supplier renegotiation", { exact: true })).toBeVisible();
  });

  test("draft recommendation autosaves and survives a reload", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=recommendation`);
    await fillSection(page, "executiveSummary", "We recommend ending always-on TechDeals discounting and fixing the free-returns policy. Net sales grew 8.5% but operating profit fell €11.9m to €7.5m, with the operating margin down from 7.1% to 2.5%. Restoring electronics pricing and supplier terms can recover most of the gap.");
    await fillSection(page, "diagnosis", "Growth destroyed value: gross margin fell from 38.5% to 33.3% because the lowest-margin category grew fastest and returns surged.");
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#rec-executiveSummary")).toHaveValue(/We recommend ending always-on TechDeals/);
  });

  test("submit the recommendation and receive feedback", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=recommendation`);
    await fillSection(page, "rootCauses", "1) Electronics price discounting (TechDeals) cut the electronics margin from 21.6% to 11.0% while unit cost rose 4.5%.\n2) Mix shift: electronics share of sales rose from 28.4% to 33.9%, diluting margin.\n3) Apparel returns rose from 7.0% to 12.2% after the free returns policy.");
    await fillSection(page, "quantitativeEvidence", "Electronics gross profit fell €5.7m despite +30% sales; apparel gross profit fell €2.0m; logistics costs rose €2.6m.");
    await fillSection(page, "recommendedActions", "1) Replace always-on TechDeals promotions with targeted electronics discounts gated by margin.\n2) Renegotiate electronics supplier terms.\n3) Introduce a returns fee below an order threshold for apparel.");
    await fillSection(page, "financialImpact", "Simulator: operating profit rises from €7.5m to about €17m with +4% electronics price and lower returns.");
    await fillSection(page, "implementationPriorities", "First, quick wins in month 1: promotion margin gate and returns threshold. Then supplier renegotiation in months 3-6.");
    await fillSection(page, "risks", "Electronics volume may fall more than the assumed elasticity, and customers may react negatively to returns fees; mitigate with loyalty exemptions and regional tests.");
    for (const [id, v] of [["netSalesGrowth", "8.53"], ["grossMargin2024", "33.32"], ["operatingMargin2024", "2.52"], ["opProfitChange", "-11.88"], ["elecMargin2024", "10.99"], ["apparelReturn2024", "12.21"]]) {
      await page.locator(`#q-${id}`).fill(v);
    }
    for (const label of ["Electronics price erosion from promotions", "Electronics unit-cost inflation", "Sales mix shift toward lower-margin categories", "Apparel returns surge"]) {
      await page.getByLabel(label).check();
    }
    await expect(page.getByText("8 of 8 sections complete")).toBeVisible();
    await page.getByRole("button", { name: "Submit for evaluation" }).click();
    await page.getByRole("button", { name: "Submit and evaluate" }).click();
    await page.waitForURL(`**/cases/${SLUG}/review`);
    await expect(page.getByTestId("headline-score")).toBeVisible();
    await expect(page.getByText("No overall score")).toBeVisible(); // honest limitation without AI
    await expect(page.getByText("Key calculations")).toBeVisible();
    await expect(page.getByTestId("dimension-accuracy")).toContainText("25 / 25");
    await expect(page.getByText("Your recommendation vs. a strong model answer")).toBeVisible();
    await expect(page.getByText(/model answer/).first()).toBeVisible();
  });

  test("reopen the completed case: locked snapshot and new attempt option", async ({ page }) => {
    await go(page, `/cases/${SLUG}?tab=recommendation`);
    await expect(page.getByText("Attempt 1 submitted and locked")).toBeVisible();
    await expect(page.locator("#rec-executiveSummary")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start new attempt" })).toBeVisible();
  });

  test("dashboard and performance center reflect real activity", async ({ page }) => {
    await go(page, "/");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText("1 evaluated submission")).toBeVisible();
    await expect(page.getByText(/Submitted “Retail Profitability Crisis”/)).toBeVisible();
    await go(page, "/performance");
    await expect(page.getByText("Submission history")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Retail Profitability Crisis" })).toBeVisible();
  });

  test("offline coach answers without an API key", async ({ page }) => {
    await go(page, `/cases/${SLUG}`);
    await page.getByRole("button", { name: "Consulting coach" }).click();
    await page.getByLabel("Message the coach").fill("Where should I start with electronics pricing?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Offline hint").first()).toBeVisible();
    await expect(page.getByText(/no ANTHROPIC_API_KEY/i).first()).toBeVisible();
  });

  test("analytics lab calculators compute live", async ({ page }) => {
    await go(page, "/analytics");
    await page.getByRole("tab", { name: "Marketing" }).click();
    await expect(page.getByTestId("calc-roas-ROAS")).toHaveText("2.35x");
    await page.locator("#roas-revenue").fill("500000");
    await expect(page.getByTestId("calc-roas-ROAS")).toHaveText("5.00x");
  });

  test("settings persist and theme switches", async ({ page }) => {
    await go(page, "/settings");
    await page.getByLabel("Display name").fill("Test Consultant");
    await page.getByLabel("Theme").selectOption("dark");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Display name")).toHaveValue("Test Consultant");
  });
});

test.describe("responsive layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("mobile navigation works", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Case Library" }).click();
    await expect(page.getByRole("heading", { name: "Consulting cases" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
