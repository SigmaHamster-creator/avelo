/**
 * Records a real screen capture of Avelo being used, for the hackathon demo
 * video. A scripted browser (Playwright) clicks through the actual running
 * app while Playwright records the page. Nothing is generated or mocked: every
 * screen is the real app responding to real input.
 *
 * Voice note: a headless browser has no microphone, so the "describe your
 * trip" text box is used. It sends text through the same extraction pipeline
 * as speech, and a caption says so.
 *
 * Usage (from avelo/):
 *   node scripts/record-demo.mjs [baseUrl]
 * Default baseUrl: http://localhost:3100 (run `npx next start --port 3100`).
 * Output: demo-video/avelo-demo.webm (1280x720, no audio).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT_DIR = path.resolve("demo-video");
const OUT_FILE = path.join(OUT_DIR, "avelo-demo.webm");
const SIZE = { width: 1280, height: 720 };

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT_DIR, size: SIZE } });
const page = await context.newPage();
const started = Date.now();
const wait = (ms) => page.waitForTimeout(ms);

/** Shows a caption bar at the bottom of the page (the video has no sound). */
async function caption(text, holdMs = 0) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        width: "680px",
        background: "rgba(31, 59, 44, 0.94)",
        color: "#ffffff",
        padding: "12px 18px",
        borderRadius: "12px",
        font: "600 19px/1.4 'Segoe UI', Arial, sans-serif",
        textAlign: "center",
        zIndex: "99999",
        pointerEvents: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  if (holdMs) await wait(holdMs);
}

/** Smoothly scrolls an element to the middle of the screen. */
async function show(locator, holdMs = 0) {
  await locator.first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await wait(700 + holdMs);
}

/** Outlines a control briefly, then clicks it, so viewers can see what was pressed. */
async function tap(locator) {
  const el = locator.first();
  await show(el);
  await el.evaluate((node) => {
    node.dataset.prevOutline = node.style.outline;
    node.style.outline = "4px solid #F2B84B";
    node.style.outlineOffset = "3px";
  });
  await wait(600);
  await el.evaluate((node) => {
    node.style.outline = node.dataset.prevOutline ?? "";
  });
  await el.click();
}

async function type(locator, text, delay = 30) {
  await show(locator);
  await locator.first().click();
  await locator.first().pressSequentially(text, { delay });
}

async function openDemoControls() {
  await page.getByRole("button", { name: "Open demo controls" }).click();
  await wait(500);
}

async function closeDemoControls() {
  await page.getByRole("button", { name: "Close demo controls" }).click();
  await wait(300);
}

async function loadScenario(label) {
  await openDemoControls();
  await page.getByLabel("Demo scenario").selectOption({ label });
  await wait(700);
  await tap(page.getByRole("button", { name: "Load Example Data" }));
  await page.waitForURL(/\/booking$/);
  await closeDemoControls();
}

async function reviewAndRequest() {
  await tap(page.getByRole("button", { name: "Review Estimate" }));
  await page.waitForURL(/\/review$/);
  await page.getByText("Round-trip total:").waitFor({ timeout: 15000 });
}

// 1. Landing --------------------------------------------------------------
await page.goto(BASE);
await page.getByRole("button", { name: "Schedule a Ride" }).waitFor({ timeout: 90000 });
await caption("Avelo helps caregivers arrange scheduled, non-emergency rides to medical appointments, and back home.", 5000);
await tap(page.getByRole("button", { name: "Schedule a Ride" }));
await page.waitForURL(/\/booking$/);

// 2. Describe the trip once -----------------------------------------------
const describeBox = page.getByLabel(/describe your trip in your own words/i);
const updateButton = page.getByRole("button", { name: "Update form from text" });
await caption("Describe the trip once, in plain English. (Typed here; the microphone button sends speech through the same pipeline.)");
await type(
  describeBox,
  "My dad needs to be at Pine Valley Hospital by 10 a.m. tomorrow. He can't transfer, he stays in his wheelchair, and I'll be coming with him.",
);
await wait(600);
await tap(updateButton);
await page.getByLabel("Destination Address", { exact: true }).and(page.locator('[value*="Valley View"]')).waitFor();
await caption("Avelo filled in the hospital and looked up its address, plus the date and arrival time.");
await show(page.getByLabel("Destination / Hospital"), 3800);
await caption("It also recorded the wheelchair need and one companion.");
await show(page.getByText("Passenger must remain in their wheelchair"), 3200);

// 3. Natural corrections ---------------------------------------------------
await caption("Corrections feel natural: only what you mention changes. No need to say \"change\".");
await type(describeBox, "Pick him up from the hospital at 2 p.m.");
await tap(updateButton);
await caption("Only the return pickup time changed. The 10:00 AM arrival is untouched.");
await show(page.getByLabel("Return Pickup Time"), 3800);

await caption("If you sound unsure, Avelo asks a question instead of guessing.");
await type(describeBox, "Actually bring him back at three or four, I'm not sure");
await tap(updateButton);
await show(page.getByText(/What exact time should I use/), 3800);

// 4. Validation ------------------------------------------------------------
await caption("One set of checks for spoken, typed, and manual input. Missing details are listed clearly.");
await tap(page.getByRole("button", { name: "Review Estimate" }));
await wait(3800);

await caption("Fill in the rest by hand. Errors clear as each field is fixed.");
await type(page.getByLabel("Your Name"), "Rose Daniels", 25);
await type(page.getByLabel("Phone Number"), "413-555-0142", 25);
await type(page.getByLabel("Passenger Name"), "Walter Daniels", 25);
await type(page.getByLabel("Pickup Address", { exact: true }), "118 Birch Hollow Road, Hadley, MA", 20);
await wait(800);

// 5. Estimate and review ---------------------------------------------------
await reviewAndRequest();
await caption("Avelo works out the suggested pickup time and explains it.");
await show(page.getByText(/^Suggested pickup:/), 4200);
await caption("A round-trip estimate up front, with no payment collected.");
await show(page.getByText("Round-trip total:"), 3500);

// 6. Simulated matching and automatic confirmation ------------------------
await tap(page.getByRole("button", { name: "Request Arrangement" }));
await caption("Avelo looks for a provider that fits the wheelchair, the companion, and both trips (simulated in this demo).");
await page.waitForURL(/\/arrangement\//, { timeout: 20000 });
await caption("The provider accepted at the same price, so the booking confirmed automatically, with no extra click.", 4000);
await show(page.getByRole("heading", { name: "Outbound Trip" }), 2500);
await show(page.getByRole("heading", { name: "Price & Status" }), 2500);

// 7. Special request and price revision -----------------------------------
await caption("Demo Controls load fictional scenarios. Next: a passenger with a special request.");
await loadScenario("Special Request / Price Revision");
await show(page.getByLabel("Additional Assistance / Special Requests"), 2500);
await reviewAndRequest();
await caption("Everyone gets an estimate immediately, with a clear note that special requests could change it.");
await show(page.getByText(/may not include additional costs for special requests/), 4200);
await tap(page.getByRole("button", { name: "Request Arrangement" }));
await page.getByRole("heading", { name: "Price Update: Action Required" }).waitFor({ timeout: 20000 });
await caption("The provider needs $15 more for oxygen-tank help. Nothing is confirmed until the caregiver decides.", 5000);
await tap(page.getByRole("button", { name: "Accept New Price and Confirm" }));
await page.waitForURL(/\/arrangement\//, { timeout: 20000 });
await caption("Accepted and confirmed at the new price.", 2500);
await show(page.getByRole("heading", { name: "Price & Status" }), 2000);

// 8. Replacement -------------------------------------------------------------
await caption("Plans change. After booking, a caregiver can ask for a different arrangement.");
await loadScenario("Replacement");
await reviewAndRequest();
await tap(page.getByRole("button", { name: "Request Arrangement" }));
await page.waitForURL(/\/arrangement\//, { timeout: 20000 });
await wait(1500);
await tap(page.getByRole("button", { name: "Request a Different Arrangement" }));
await type(page.getByLabel("Why would you like a different arrangement?"), "The van needs to arrive earlier for us.", 30);
await tap(page.getByRole("button", { name: "Request Replacement" }));
await caption("The confirmed ride stays in place while Avelo finds a replacement.");
await page.getByText(/arranging a replacement/i).waitFor({ timeout: 10000 });
await show(page.getByRole("heading", { name: "Provider" }));
await page.getByText("Berkshire Accessible Transport").waitFor({ timeout: 20000 });
await caption("Replacement confirmed with a new provider.", 3800);

// 9. Reset and close --------------------------------------------------------
await openDemoControls();
await tap(page.getByRole("button", { name: "Reset" }));
await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
await caption("Avelo: every journey, thoughtfully arranged. Built with Kiro.", 4500);

const seconds = Math.round((Date.now() - started) / 1000);
const video = page.video();
await context.close();
await browser.close();

const recorded = await video.path();
if (existsSync(OUT_FILE)) rmSync(OUT_FILE);
renameSync(recorded, OUT_FILE);
console.log(`Saved ${OUT_FILE} (about ${seconds} seconds)`);
if (seconds >= 180) console.log("WARNING: over 3 minutes; trim before uploading.");
