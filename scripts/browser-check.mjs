import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { root, getSite } from "./build.mjs";

const base = process.env.TEST_URL || "http://127.0.0.1:4173";
const site = await getSite();
const approvedCitations = JSON.parse(await readFile(path.join(root, "scripts/fixtures/approved-citations.json"), "utf8"));
const screenshots = path.join(root, "test-results");
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const errors = [];
const failures = [];
const report = (message) => console.log(`PASS: ${message}`);
async function pageFor(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  return { page, context };
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Horizontal overflow",
  );
}
try {
  const { page, context } = await pageFor({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await page.goto(base);
  await page.locator("canvas[data-world-renderer]").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#world-fallback").hidden,
  );
  assert.equal(await page.locator(".world-hotspot").count(), 5);
  assert.ok(await page.locator("#workspace-popover").isHidden());
  assert.equal(await page.locator("#district-detail, #district-action").count(), 0);
  assert.equal(await page.locator(".publication-card:visible").count(), 7);
  assert.equal(await page.locator(".publication-card:visible").first().getAttribute("data-paper"), "world-action-agent");
  assert.equal(await page.locator('[data-paper="dalfnet"]').count(), 0);
  assert.equal(await page.locator(".paper-art:visible").count(), 0);
  assert.ok(await page.locator(".authorship-legend").isVisible());
  for (const paper of site.publications) {
    const card = page.locator(`[data-paper="${paper.slug}"]`);
    const authors = paper.authors.replace(", and ", ", ").split(", ");
    assert.deepEqual(await card.locator(".paper-author").evaluateAll(nodes => nodes.map(n => n.dataset.author)), authors);
    for (const author of authors) {
      const node = card.locator(`.paper-author[data-author="${author}"]`);
      assert.equal(await node.locator('[title="Co-first author"]').count(), Number(paper.co_first_authors.includes(author)));
      assert.equal(await node.locator('[title="Corresponding author"]').count(), Number(paper.corresponding_authors.includes(author)));
    }
  }
  report("co-first and corresponding-author markers match every publication's metadata");
  assert.equal(await page.locator(".pub-button").count(), 2);
  assert.equal(await page.locator(".resume-row").count(), 4);
  assert.equal(await page.locator('[data-filter="all"]').getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator("#motion-toggle").getAttribute("aria-pressed"),
    "true",
  );
  await noOverflow(page);
  await page.screenshot({
    path: path.join(screenshots, "desktop.png"),
    fullPage: true,
  });
  await page
    .locator("#world-frame")
    .screenshot({ path: path.join(screenshots, "world-day.png") });
  report(
    "desktop WebGL renderer, five hotspots, seven papers by default, four résumé rows",
  );

  // Click the real Three.js book and photo geometries at the fixed overview camera.
  // These coordinates are fractions of the tested 1440px layout, not DOM buttons.
  const modelBounds = await page.locator("#world-frame").boundingBox();
  await page.mouse.click(modelBounds.x + modelBounds.width * 0.33, modelBounds.y + modelBounds.height * 0.465);
  assert.equal(await page.locator("#district-title").textContent(), "The Reading Room");
  assert.ok(!(await page.locator("#content-dialog").evaluate(node => node.open)));
  await page.locator('[data-preview-notebook="memory"]').click();
  assert.equal(await page.locator("#dialog-title").textContent(), "On memory");
  await page.keyboard.press("Escape");
  await page.locator("#reset-view").click();
  await page.mouse.click(modelBounds.x + modelBounds.width * 0.452, modelBounds.y + modelBounds.height * 0.552);
  assert.equal(await page.locator("#district-title").textContent(), "The Photo Wall");
  assert.equal(await page.locator("#workspace-preview img").count(), 2);
  assert.ok(!(await page.locator("#content-dialog").evaluate(node => node.open)));
  await page.locator("#world-frame").screenshot({ path: path.join(screenshots, "workspace-photo-preview.png") });
  await page.locator(".workspace-photo-preview").click();
  assert.equal(new URL(page.url()).hash, "#gallery");
  assert.ok(await page.locator("#workspace-popover").isHidden());
  await page.locator("#reset-view").click();
  report("3D books and photo frames open in-workspace previews before full content");

  await page.locator('.district-tab[data-district="embodied"]').click();
  assert.equal(
    await page.locator("#district-title").textContent(),
    "Embodied Lab",
  );
  assert.equal(await page.locator("#district-description").textContent(), "");
  assert.equal(await page.locator("#workspace-popover a").count(), 0);
  assert.ok(await page.locator("#world-frame > #workspace-popover").isVisible());
  const frameBounds = await page.locator("#world-frame").boundingBox();
  const popupBounds = await page.locator("#workspace-popover").boundingBox();
  assert.ok(popupBounds.x >= frameBounds.x && popupBounds.y >= frameBounds.y);
  assert.ok(popupBounds.x + popupBounds.width <= frameBounds.x + frameBounds.width);
  assert.ok(popupBounds.y + popupBounds.height <= frameBounds.y + frameBounds.height);
  await page.locator("#world-frame").screenshot({ path: path.join(screenshots, "workspace-research-preview.png") });
  await page.keyboard.press("Escape");
  assert.ok(await page.locator("#workspace-popover").isHidden());
  assert.equal(await page.evaluate(() => document.activeElement.dataset.district), "embodied");
  // Assert opening motion on a regular-motion visit, then return to still-mode screenshots.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const animationDurations = await page.evaluate(() => {
    document.querySelector('.district-tab[data-district="agents"]').click();
    return document.querySelector("#workspace-popover").getAnimations().map(animation => animation.effect.getTiming().duration);
  });
  assert.deepEqual(animationDurations, [240]);
  await page.locator('.district-tab[data-district="workshop"]').click();
  assert.equal(await page.locator("#district-title").textContent(), "The Workshop");
  assert.equal(await page.locator("#workspace-popover a").count(), 0);
  await page.locator("#close-workspace-popover").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('.world-hotspot[data-district="agents"]').click();
  assert.ok(await page.locator("#workspace-popover").isVisible());
  assert.equal(await page.locator("#workspace-popover").evaluate(node => node.getAnimations().length), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".publication-card:visible").count(), 7);
  await page.locator("#publications").screenshot({ path: path.join(screenshots, "publications-all.png") });
  await page.locator("#experience").screenshot({ path: path.join(screenshots, "experience.png") });
  await page.locator('[data-filter="selected"]').click();
  assert.equal(await page.locator(".paper-art:visible").count(), 3);
  assert.deepEqual(
    (
      await page
        .locator(".publication-card:visible")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.paper))
    ).sort(),
    ["orchestrating-audio", "videomemory", "worldlines"],
  );
  await page.locator("#publications").screenshot({ path: path.join(screenshots, "publications-selected.png") });
  report("research preview stays within workspace, has no paper link, closes with focus restored; Selected contains three approved papers");

  await page.locator('[data-cite="orchestrating-audio"]').click();
  assert.ok(
    await page.locator("#content-dialog").evaluate((node) => node.open),
  );
  await page.locator(".copy-citation").click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clipboard.includes("Orchestrating Audio"));
  assert.match(clipboard, /^@inproceedings\{/);
  assert.equal(clipboard, approvedCitations["orchestrating-audio"]);
  await page.locator("#content-dialog").screenshot({ path: path.join(screenshots, "bibtex.png") });
  await page.keyboard.press("Escape");
  assert.ok(
    !(await page.locator("#content-dialog").evaluate((node) => node.open)),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.cite),
    "orchestrating-audio",
  );
  report("paper dialog, working citation copy, Escape and focus restoration");
  await page.locator('[data-filter="all"]').click();
  for (const [slug, citation] of Object.entries(approvedCitations)) {
    await page.locator(`[data-cite="${slug}"]`).click();
    assert.equal(await page.locator(".citation-text").textContent(), citation);
    await page.locator(".copy-citation").click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), citation);
    await page.keyboard.press("Escape");
  }
  report("all seven Cite dialogs copy the complete user-approved BibTeX exactly");

  await page.locator('[data-notebook="memory"]').click();
  assert.equal(await page.locator("#dialog-title").textContent(), "On memory");
  assert.ok(
    (await page.locator("#dialog-content").textContent()).includes(
      "No entries have been published yet",
    ),
  );
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector("#content-dialog")
        .contains(document.activeElement),
    ),
    "Dialog must trap keyboard focus",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".photo-card").count(), 2);
  assert.equal(await page.locator('#gallery img[src*="avatar"]').count(), 0);
  for (const id of ["riverside", "aircraft"]) {
    const card = page.locator(`.photo-card[data-photo="${id}"]`);
    await card.click();
    assert.equal(await page.locator(".dialog-photo").count(), 1);
    assert.equal(await page.locator(".dialog-photo").getAttribute("src"), await card.locator("img").getAttribute("src"));
    await page.waitForFunction(() => {
      const image = document.querySelector(".dialog-photo");
      return image.complete && image.naturalWidth > 0;
    });
    await page.keyboard.press("Escape");
  }
  await page.locator("#gallery").screenshot({ path: path.join(screenshots, "photos.png") });
  report(
    "honest empty notebooks, keyboard dialog behavior, two supplied photos with matching full-size previews",
  );

  await page.locator("#academic-toggle").click();
  assert.ok(await page.locator("#neighborhood").isHidden());
  assert.equal(await page.locator(".publication-card:visible").count(), 7);
  await page.reload();
  assert.ok(await page.locator("#neighborhood").isHidden());
  assert.equal(
    await page.locator("canvas").count(),
    0,
    "Academic view must not initialize WebGL",
  );
  await page.locator("#academic-toggle").click();
  await page.locator("canvas[data-world-renderer]").waitFor();
  await page.locator("#world-frame").scrollIntoViewIfNeeded();
  await page.locator("#light-toggle").click();
  assert.ok(
    (await page.locator("#world-frame").getAttribute("class")).includes(
      "evening",
    ),
  );
  await page
    .locator("#world-frame")
    .screenshot({ path: path.join(screenshots, "world-evening.png") });
  await page.locator("#light-toggle").click();
  await page.locator("#zoom-in").click();
  await page.locator("#reset-view").click();
  const before = await page.locator("canvas").screenshot();
  const bounds = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width * 0.46,
    bounds.y + bounds.height * 0.6,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.6,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(350);
  const after = await page.locator("canvas").screenshot();
  assert.notDeepEqual(before, after, "Dragging must rotate actual geometry");
  await page.locator("#reset-view").click();
  report(
    "persisted academic mode, lazy WebGL loading, day/night, zoom/reset, actual orbit controls",
  );
  await context.close();

  const mobile = await pageFor({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await mobile.page.goto(base);
  await mobile.page.locator("canvas").waitFor();
  await mobile.page.waitForFunction(
    () => document.querySelector("#world-fallback").hidden,
  );
  await noOverflow(mobile.page);
  await mobile.page.locator('[data-filter="selected"]').tap();
  assert.equal(await mobile.page.locator(".paper-art:visible").count(), 3);
  await noOverflow(mobile.page);
  await mobile.page.locator('[data-cite="worldlines"]').tap();
  await noOverflow(mobile.page);
  assert.ok((await mobile.page.locator(".citation-text").textContent()).includes("2606.18847"));
  await mobile.page.locator("#close-dialog").tap();
  await mobile.page.locator('[data-filter="all"]').tap();
  await mobile.page.locator('[data-photo="aircraft"]').tap();
  assert.equal(await mobile.page.locator("#dialog-title").textContent(), "2024 · Zhuhai Airshow");
  await noOverflow(mobile.page);
  await mobile.page.locator("#close-dialog").tap();
  await mobile.page.locator("#gallery").screenshot({ path: path.join(screenshots, "photos-mobile.png") });
  await mobile.page.locator('.district-tab[data-district="notes"]').tap();
  assert.equal(
    await mobile.page.locator("#district-title").textContent(),
    "The Reading Room",
  );
  await mobile.page.locator('.district-tab[data-district="gallery"]').tap();
  assert.ok(await mobile.page.locator("#workspace-popover").isVisible());
  await noOverflow(mobile.page);
  await mobile.page.locator("#world-frame").screenshot({ path: path.join(screenshots, "workspace-mobile-preview.png") });
  await mobile.page.locator(".workspace-photo-preview").tap();
  assert.equal(new URL(mobile.page.url()).hash, "#gallery");
  assert.ok(await mobile.page.locator("#workspace-popover").isHidden());
  await mobile.page.screenshot({
    path: path.join(screenshots, "mobile.png"),
    fullPage: true,
  });
  await mobile.page
    .locator("#world-frame")
    .screenshot({ path: path.join(screenshots, "world-mobile.png") });
  report("390px touch layout, no overflow, usable district navigation");
  await mobile.context.close();

  const fallback = await pageFor({ viewport: { width: 1280, height: 900 } });
  await fallback.page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.page.goto(base);
  await fallback.page.waitForFunction(() =>
    document
      .querySelector("#world-fallback>span")
      .textContent.includes("unavailable"),
  );
  await fallback.page.locator('.district-tab[data-district="agents"]').click();
  assert.ok(await fallback.page.locator("#workspace-popover").isVisible());
  assert.equal(await fallback.page.locator("#district-title").textContent(), "Agents Quarter");
  await fallback.page.locator("#close-workspace-popover").click();
  assert.equal(
    await fallback.page.locator(".publication-card:visible").count(),
    7,
  );
  report(
    "WebGL-unavailable fallback preserves district navigation and publications",
  );
  await fallback.context.close();

  const nojs = await pageFor({
    javaScriptEnabled: false,
    viewport: { width: 1024, height: 768 },
  });
  await nojs.page.goto(base);
  assert.equal(await nojs.page.locator(".publication-card:visible").count(), 7);
  assert.ok(
    await nojs.page.locator('a[href*="I_C_lPYAAAAJ"]').first().isVisible(),
  );
  await noOverflow(nojs.page);
  report("no-JavaScript academic content and Scholar link remain available");
  await nojs.context.close();

  assert.deepEqual(errors, [], `Browser errors: ${errors.join("; ")}`);
  assert.deepEqual(failures, [], `Failed resources: ${failures.join("; ")}`);
  console.log(`Screenshots saved to ${screenshots}`);
} finally {
  await browser.close();
}
