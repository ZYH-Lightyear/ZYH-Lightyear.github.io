import { readFile, readdir, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import yaml from "js-yaml";
import { Liquid } from "liquidjs";
import MarkdownIt from "markdown-it";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const output = path.join(root, "_preview");
const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});
export async function frontmatter(file) {
  const raw = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { data: {}, content: raw };
  return {
    data: yaml.load(match[1]) || {},
    content: raw.slice(match[0].length),
  };
}
export async function collection(name, prefix) {
  let files;
  try {
    files = await readdir(path.join(root, `_${name}`));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const documents = [];
  for (const file of files
    .filter((name) => /\.md$/.test(name) && name !== "README.md")
    .sort()) {
    const { data, content } = await frontmatter(
      path.join(root, `_${name}`, file),
    );
    if (!data.title || data.published === false) continue;
    const slug = file.replace(/\.md$/, "");
    documents.push({
      ...data,
      date: data.date ? new Date(data.date).toISOString() : "",
      url: data.permalink || `/${prefix}/${slug}/`,
      content: markdown.render(content),
    });
  }
  return documents;
}
export async function getSite() {
  const config = yaml.load(
    await readFile(path.join(root, "_config.yml"), "utf8"),
  );
  return {
    ...config,
    baseurl: process.env.PREVIEW_BASEURL ?? config.baseurl ?? "",
    data: {
      studio: yaml.load(
        await readFile(path.join(root, "_data/studio.yml"), "utf8"),
      ),
    },
    publications: await collection("publications", "publications"),
    notes: await collection("notes", "notes"),
    photo_stories: await collection("photo_stories", "journal"),
  };
}
export async function bundleAssets() {
  const result = await build({
    entryPoints: [path.join(root, "src/main.js")],
    outdir: path.join(root, "assets/js/studio"),
    bundle: true,
    format: "esm",
    splitting: true,
    minify: true,
    sourcemap: false,
    target: ["es2022"],
    chunkNames: "chunks/[name]-[hash]",
    legalComments: "linked",
    logLevel: "warning",
    metafile: true,
  });
  // Keep only current generated chunks when preparing a branch-based Pages release.
  const live = new Set(Object.keys(result.metafile.outputs).flatMap(file => {
    const absolute = path.resolve(file);
    return [absolute, `${absolute}.LEGAL.txt`];
  }));
  const chunks = path.join(root, "assets/js/studio/chunks");
  for (const file of await readdir(chunks)) {
    const absolute = path.join(chunks, file);
    if (/^world-[A-Z0-9]+\.js(?:\.LEGAL\.txt)?$/.test(file) && !live.has(absolute))
      await unlink(absolute);
  }
  return result;
}
export async function renderPages() {
  const site = await getSite();
  const engine = new Liquid({
    root: path.join(root, "_includes"),
    extname: "",
    dynamicPartials: false,
  });
  engine.registerFilter("jsonify", (value) =>
    JSON.stringify(value ?? null).replace(/</g, "\\u003c"),
  );
  engine.registerFilter("markdownify", (value) => markdown.render(value || ""));
  const page = (await frontmatter(path.join(root, "_pages/about.md"))).data;
  const source = await readFile(
    path.join(root, "_layouts/research-home.html"),
    "utf8",
  );
  const html = await engine.parseAndRender(source, { site, page });
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "index.html"), html);
  // Aliases from the existing homepage remain usable in the local preview.
  await mkdir(path.join(output, "about"), { recursive: true });
  await writeFile(path.join(output, "about/index.html"), html);
  await writeFile(path.join(output, "about.html"), html);
  const readingLayout = await readFile(
    path.join(root, "_layouts/studio-entry.html"),
    "utf8",
  );
  for (const entry of [...site.notes, ...site.photo_stories]) {
    if (!/^\/(notes|journal)\/[a-zA-Z0-9/_-]+\/$/.test(entry.url))
      throw new Error(`Invalid entry permalink: ${entry.url}`);
    const destination = path.join(output, entry.url, "index.html");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(
      destination,
      await engine.parseAndRender(readingLayout, {
        site,
        page: entry,
        content: entry.content,
      }),
    );
  }
  return { site, html };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await bundleAssets();
  if (!process.argv.includes("--assets")) {
    const { site } = await renderPages();
    console.log(
      `Local preview built: ${site.publications.length} papers, ${site.notes.length} notes, ${site.photo_stories.length} photo stories.`,
    );
    console.log("Run npm run dev to preview. Nothing has been deployed.");
  }
}
