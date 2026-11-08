// UI smoke test against the exported app. Start a static server on port 8080 first.
import { chromium } from "playwright";
import assert from "node:assert/strict";
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8080");
    await page.getByRole("button", { name: "Get started" }).click();
    await page
      .getByRole("button", { name: "Translate text", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Text to translate" })
      .fill("Hello");
    await page.getByRole("button", { name: "Translate", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Connect your development API" })
      .waitFor();
    await page.getByRole("tab", { name: "Calls" }).click();
    await page.getByText("Paired translation", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "History" }).click();
    await page.getByText("Private by default", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Settings" }).click();
    const consent = page.getByRole("switch", {
      name: "Save translation history on this device",
    });
    assert.equal(await consent.isChecked(), false);
    await consent.check();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("linguacall.preferences") || "{}")
          .history === true,
    );
    await consent.uncheck();
    await page.waitForFunction(
      () => localStorage.getItem("linguacall.history") === null,
    );
    await page
      .getByRole("button", { name: "Delete local data & disconnect" })
      .click();
    await page.getByRole("button", { name: "Get started" }).waitFor();
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByRole("tab", { name: "Home" }).click();
    await page.setViewportSize({ width: 1024, height: 900 });
    await page
      .getByRole("button", { name: "Translate text", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: onboarding, navigation, missing-provider feedback, consent/deletion, reset, tablet viewport; no page errors.",
    );
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
