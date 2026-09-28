import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { root, getSite, bundleAssets, renderPages } from "./build.mjs";

const site = await getSite();
assert.equal(
  site.publications.length,
  6,
  "Show six publications; keep DALFNet unpublished.",
);
assert.ok(
  site.publications.every((paper) => !/\bPCSA\b|DALFNet/i.test(paper.title)),
  "PCSA and DALFNet are explicitly excluded.",
);
assert.equal(
  new Set(site.publications.map((paper) => paper.slug)).size,
  site.publications.length,
  "Paper IDs must be unique.",
);
for (const paper of site.publications) {
  assert.ok(
    paper.title &&
      paper.citation &&
      paper.authors &&
      paper.bibtex &&
      paper.date,
    `Incomplete publication: ${paper.slug}`,
  );
  assert.equal(new URL(paper.paperurl).protocol, "https:");
  assert.match(paper.bibtex, /^@(inproceedings|misc)\{/);
  assert.ok(paper.bibtex.includes(paper.title));
  assert.ok(paper.bibtex.includes(paper.paperurl));
}
assert.deepEqual(site.publications.filter(p => p.selected).map(p => p.slug).sort(),
  ["orchestrating-audio", "videomemory", "worldlines"]);
const ids = new Set(site.publications.map((paper) => paper.slug));
assert.equal(new Set(site.data.studio.districts.map((d) => d.id)).size, 5);
for (const district of site.data.studio.districts) {
  district.papers.forEach((id) =>
    assert.ok(ids.has(id), `Unknown district paper: ${id}`),
  );
}
await bundleAssets();
const { html } = await renderPages();
assert.deepEqual(
  [...html.matchAll(/class="paper-venue">([^<]+)</g)].map(match => match[1]),
  ["Preprint, 2026", "EMNLP 2026", "ICASSP 2026", "Preprint, 2026", "EMNLP 2025", "BDAI 2023"],
  "Use concise venue labels, including WorldLines at EMNLP 2026.",
);
const worldlines = site.publications.find(paper => paper.slug === "worldlines");
assert.equal(worldlines.category, "conferences");
assert.match(worldlines.bibtex, /^@inproceedings\{/);
assert.ok(worldlines.bibtex.includes("(EMNLP)"));
assert.ok(
  !html.includes("{%") && !/\{\{\s*(site|paper|page)\./.test(html),
  "All Liquid markup must be rendered.",
);
assert.ok(html.includes("I_C_lPYAAAAJ"), "Keep the author’s Scholar profile.");
assert.ok(
  html.includes("first-year PhD") &&
    html.includes("MPhil in Artificial Intelligence"),
);
assert.ok(
  !/SleepFormer|Haidilao|3026|2199/.test(html),
  "Do not publish template biography, papers, or blog posts.",
);
assert.ok(
  html.includes("No entries") || html.includes("First entries coming soon."),
);
assert.ok(html.includes("Y. Zhang</strong>"));
assert.ok(html.includes("Yehang Zhang</strong>"));
assert.ok(!/data-open-paper|paper-summary|paper-area|data-filter="(agents|embodied|multimodal)"/.test(html));
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "DOM IDs must be unique.");
for (const match of html.matchAll(/href="#([^"]+)"/g))
  assert.ok(htmlIds.includes(match[1]), `Broken internal anchor: ${match[1]}`);
const chunks = await readdir(path.join(root, "assets/js/studio/chunks"));
const mainBytes = gzipSync(
  await readFile(path.join(root, "assets/js/studio/main.js")),
).length;
assert.ok(
  mainBytes < 15_000,
  "Keep the initial UI bundle under 15 KB compressed.",
);
console.log(
  `PASS: biography, six papers, five district mappings, template removal, unique IDs, anchors, build.`,
);
console.log(
  `Initial UI JavaScript: ${(mainBytes / 1024).toFixed(1)} KB gzip. Three.js loads separately on demand (${chunks.filter((f) => f.endsWith(".js")).length} chunk files).`,
);
