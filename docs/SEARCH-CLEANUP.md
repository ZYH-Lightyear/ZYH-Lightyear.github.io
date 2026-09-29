# Search and template cleanup (2026-09-29)

## Published content

- Homepage title and Open Graph title share `_pages/about.md`'s title: `Yehang Zhang | HKUST (Guangzhou)`.
- The homepage keeps its self-referencing canonical URL and its biography and publications in static HTML.
- Sitemap inclusion is opt-in: homepage, publication archive, real publication documents, and published notes/photo stories. Assets, utility pages and redirects are not search landing pages.
- The human-readable `/sitemap/` lists only real content instead of every template page.
- The homepage modification date reflects this content update, not an invented future date.

## Preserved in Git but excluded from the published site

- All sample posts, including the 2199 example; sample portfolio, talks and teaching collections.
- Template CV ("GitHub University"), demo Markdown/layout pages, empty archives, talk map and template terms page.
- `files/paper1.pdf` through `paper3.pdf`, `slides1.pdf` through `slides3.pdf`.
- Markdown-generator and talk-map development tools, collection READMEs and contribution instructions.
- The template blog feed is disabled and the legacy footer no longer links to it.

No real papers, photos, notes or source examples were deleted. The real XGBoost PDF remains downloadable. Removed example URLs should return 404 after deployment, not redirect to unrelated homepage content. The original about-page aliases are retained.

## Google follow-up (requires the owner's Search Console access)

After deployment, inspect `https://zyh-lightyear.github.io/` in Google Search Console, check its Google-selected canonical and request indexing. Submit `https://zyh-lightyear.github.io/sitemap.xml`. This does not guarantee indexing, ranking, or immediate replacement of cached titles.

References:
- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://github.com/jekyll/jekyll-sitemap#exclusions
