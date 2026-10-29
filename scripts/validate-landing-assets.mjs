import { readFileSync } from 'node:fs';
import { LANDING_SCREENSHOTS, landingScreenshotUrl } from '../src/landingScreenshots.js';

// Catch missing active screenshots before a production archive can be created.
let pairs = 0;
for (const id of Object.keys(LANDING_SCREENSHOTS)) {
  for (const theme of ['dark','light']) {
    const bytes = readFileSync(new URL(`../public${landingScreenshotUrl(id,theme)}`,import.meta.url));
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error(`Invalid Demo screenshot: ${id}/${theme}`);
    pairs++;
  }
}
console.log(`Validated ${pairs} theme-matched Demo screenshots.`);
