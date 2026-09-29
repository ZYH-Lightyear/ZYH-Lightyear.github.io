import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { root, getSite, frontmatter, bundleAssets, renderPages } from "./build.mjs";

const site = await getSite();
const approvedCitations = JSON.parse(await readFile(path.join(root, "scripts/fixtures/approved-citations.json"), "utf8"));
assert.equal(
  site.publications.length,
  7,
  "Show seven publications including World Action Agent; keep DALFNet unpublished.",
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
  assert.match(paper.bibtex, /^@(inproceedings|misc|article)\{/i);
  assert.equal(paper.bibtex, approvedCitations[paper.slug], `Preserve the user-provided citation for ${paper.slug}.`);
  assert.ok(paper.bibtex.toLowerCase().includes(paper.title.toLowerCase()));
  assert.ok(paper.bibtex.includes(paper.paperurl.replace("https://doi.org/", "")));
  assert.ok(!/\]\(https?:|&#x/.test(paper.bibtex), "Do not copy Markdown/HTML wrappers into BibTeX.");
  const authors = paper.authors.replace(", and ", ", ").split(", ");
  for (const role of ["co_first_authors", "corresponding_authors"]) {
    assert.ok(Array.isArray(paper[role]), `Missing authorship data for ${paper.slug}.`);
    assert.equal(new Set(paper[role]).size, paper[role].length);
    for (const author of paper[role]) assert.ok(authors.includes(author), `Unknown ${role}: ${author}`);
  }
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
const homePage = (await frontmatter(path.join(root, "_pages/about.md"))).data;
assert.equal(homePage.title, "Yehang Zhang | HKUST (Guangzhou)");
assert.ok(html.includes(`<title>${homePage.title}</title>`));
assert.ok(html.includes(`<meta property="og:title" content="${homePage.title}"`));
assert.ok(html.includes(`rel="canonical" href="${site.url}${site.baseurl}/"`));
assert.ok(!/Lighthearted Homepage|Short Bio|<title>.*Research Neighborhood/.test(html));
assert.equal(homePage.sitemap, true);
assert.equal(site.future, false);
assert.equal(site.atom_feed.hide, true);
assert.ok(!site.plugins.includes("jekyll-feed"));
assert.equal(site.defaults[0].values.sitemap, false, "Sitemap must opt in real content, not every static file.");
for (const type of ["publications", "notes", "photo_stories"]) {
  assert.equal(site.defaults.find(rule => rule.scope.type === type).values.sitemap, true);
  assert.equal(site.collections[type].output, true);
}
for (const type of ["portfolio", "talks", "teaching"]) assert.equal(site.collections[type].output, false);
for (const file of ["_posts", "_portfolio", "_talks", "_teaching", "_notes/README.md", "_photo_stories/README.md",
  "_pages/cv.md", "_pages/markdown.md", "_pages/terms.md", "_pages/year-archive.html",
  "files/paper1.pdf", "files/paper2.pdf", "files/paper3.pdf", "files/slides1.pdf", "files/slides2.pdf", "files/slides3.pdf",
  "markdown_generator", "talkmap", "talkmap.py", "talkmap.ipynb"]) {
  assert.ok(site.exclude.includes(file), `Template content must not be published: ${file}`);
}
const retainedPages = [];
for (const file of await readdir(path.join(root, "_pages"))) {
  if (site.exclude.includes(`_pages/${file}`)) continue;
  retainedPages.push(file);
  const { content } = await frontmatter(path.join(root, "_pages", file));
  assert.ok(!/GitHub University|Professor Hub|sample blog post|2199/.test(content));
}
assert.deepEqual(retainedPages.sort(), ["404.md", "about.md", "publications.html", "sitemap.md"]);
assert.equal((await frontmatter(path.join(root, "_pages/publications.html"))).data.sitemap, true);
assert.ok(!site.exclude.includes("files/An_Enhanced_XGBoost_Algorithm_for_Mobile_Price_Classification.pdf"));
console.log("PASS: homepage search metadata, opt-in sitemap, template exclusions, real content retained.");
assert.ok(html.includes("† Co-first author") && html.includes("✉ Corresponding author"));
for (const role of ["Co-first author", "Corresponding author"]) {
  const field = role === "Co-first author" ? "co_first_authors" : "corresponding_authors";
  assert.equal([...html.matchAll(new RegExp(`title="${role}"`, "g"))].length,
    site.publications.reduce((count, paper) => count + paper[field].length, 0));
}
for (const slug of ["worldlines", "world-action-agent", "videomemory"]) {
  assert.deepEqual(site.publications.find(p => p.slug === slug).corresponding_authors, ["Ying-Cong Chen"],
    "Project leaders must not be marked as corresponding authors.");
}
assert.deepEqual(
  [...html.matchAll(/class="paper-venue">([^<]+)</g)].map(match => match[1]),
  ["Preprint, 2026", "Preprint, 2026", "EMNLP 2026", "ICASSP 2026", "Preprint, 2026", "EMNLP 2025", "BDAI 2023"],
  "Use concise venue labels, including WorldLines at EMNLP 2026.",
);
const worldlines = site.publications.find(paper => paper.slug === "worldlines");
assert.equal(worldlines.category, "conferences");
assert.equal(worldlines.display_venue, "EMNLP 2026");
assert.match(worldlines.bibtex, /^@misc\{zhang2026worldlinesbenchmarkingmodelinglonghorizon,/);
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
  `PASS: biography, seven papers, exact user-provided citations, five district mappings, template removal, unique IDs, anchors, build.`,
);
console.log(
  `Initial UI JavaScript: ${(mainBytes / 1024).toFixed(1)} KB gzip. Three.js loads separately on demand (${chunks.filter((f) => f.endsWith(".js")).length} chunk files).`,
);
