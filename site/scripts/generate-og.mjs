// Generates site/public/og-image.png from og-template.html.
// Usage: node site/scripts/generate-og.mjs

import puppeteer from "puppeteer-core";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(__dirname, "og-template.html");
const outputPath = resolve(__dirname, "../public/og-image.png");

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
await page.goto(`file://${templatePath}`, { waitUntil: "networkidle0" });
await page.screenshot({ path: outputPath, type: "png" });
await browser.close();

console.log(`Generated ${outputPath}`);
