// Captures the REAL pay page of the running simulation server (localhost:8787) in four states.
// Usage: node video/capture/capture.mjs <invoiceId>
// The only intervention: the payment request is held ~1.2 s so the real "signing authorization…" UI state can be photographed.
import { createRequire } from "node:module";
const puppeteer = createRequire(import.meta.url)("/Users/parthsingh/.local/lib/node_modules/hyperframes/node_modules/puppeteer-core");
const id = process.argv[2];
if (!id) { console.error("usage: capture.mjs <invoiceId>"); process.exit(1); }
const out = new URL("./shots/", import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 560, height: 760, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: process.env.SCHEME ?? "light" }]);
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (r.headers()["payment-signature"]) setTimeout(() => r.continue(), 1200); else r.continue();
});
const url = `http://localhost:8787/i/${id}`;
await page.goto(url, { waitUntil: "networkidle0" });
await page.screenshot({ path: out + "1-unpaid.png" });
await page.click("#fund");
await page.waitForFunction(() => document.getElementById("out").textContent.includes("funded"));
await page.screenshot({ path: out + "2-funded.png" });
await page.click("#burner");
await page.waitForFunction(() => document.getElementById("out").textContent.includes("signing authorization"));
await new Promise((r) => setTimeout(r, 150));
await page.screenshot({ path: out + "3-signing.png" });
await page.waitForSelector("p.ok", { timeout: 15000 }); // after the client reloads the page, the server renders PAID · tx …
await page.screenshot({ path: out + "4-paid.png" });
console.log(await page.$eval("p.ok", (e) => e.textContent));
await browser.close();
