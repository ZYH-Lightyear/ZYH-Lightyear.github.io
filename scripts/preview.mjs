import http from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { root, output, bundleAssets, renderPages } from "./build.mjs";

await bundleAssets();
let { site } = await renderPages();
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(
      new URL(request.url, `http://127.0.0.1:${port}`).pathname,
    );
    if (site.baseurl && pathname.startsWith(site.baseurl + "/"))
      pathname = pathname.slice(site.baseurl.length);
    if (pathname.includes("\0") || pathname.split("/").includes(".."))
      throw new Error("Invalid path");
    const isAsset = /^\/(assets|images|files)\//.test(pathname);
    // Never serve .git, credentials, project sources, or arbitrary filesystem paths.
    if (
      !isAsset &&
      !/^\/(?:$|about(?:\/|\.html)|notes\/|journal\/)/.test(pathname)
    ) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found in the local design preview.");
      return;
    }
    const base = isAsset ? root : output;
    let file = path.resolve(base, "." + pathname);
    if (!file.startsWith(base + "/") && file !== base)
      throw new Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found.");
  }
});
server.on("error", (error) => {
  console.error(`Preview could not start: ${error.message}`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Research Neighborhood → http://127.0.0.1:${port}${site.baseurl}/\nLocal-only preview. Edit content, then refresh the browser.`,
  ),
);

let rebuilding = false,
  queued = false;
async function rebuild() {
  if (rebuilding) {
    queued = true;
    return;
  }
  rebuilding = true;
  try {
    await bundleAssets();
    ({ site } = await renderPages());
    console.log("Rebuilt — refresh the browser.");
  } catch (error) {
    console.error("Build error:", error.message);
  } finally {
    rebuilding = false;
    if (queued) {
      queued = false;
      rebuild();
    }
  }
}
// Poll a small, explicit set of source files. This also works on Macs where the
// filesystem watcher limit has already been used by other research projects.
const watchFolders = [
  "src",
  "_layouts",
  "_includes",
  "_data",
  "_pages",
  "_publications",
  "_notes",
  "_photo_stories",
];
async function sourceStamp() {
  const stamps = [];
  for (const folder of watchFolders) {
    try {
      const files = await readdir(path.join(root, folder), {
        withFileTypes: true,
      });
      for (const file of files.filter((file) => file.isFile())) {
        const info = await stat(path.join(root, folder, file.name));
        stamps.push(`${folder}/${file.name}:${info.mtimeMs}:${info.size}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const config = await stat(path.join(root, "_config.yml"));
  stamps.push(`config:${config.mtimeMs}`);
  return stamps.sort().join("|");
}
let previous = await sourceStamp();
setInterval(async () => {
  try {
    const next = await sourceStamp();
    if (next !== previous) {
      previous = next;
      await rebuild();
    }
  } catch (error) {
    console.warn("Preview file check:", error.message);
  }
}, 1200).unref();
