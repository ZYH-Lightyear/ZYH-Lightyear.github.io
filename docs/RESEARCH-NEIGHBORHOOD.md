# Research Neighborhood — local design v1

This is a local redesign of Yehang Zhang's academic homepage, based on
[WowPage](https://github.com/WD7ang/WowPage), with an original Three.js miniature
research neighborhood. The live website has not been updated.

## Preview

Requirements: Node.js 20 or newer, npm. Browser checks use an installed Google Chrome.

```sh
cd /Users/zyh/mine/ZYH-Lightyear.github.io
npm ci
npm run dev
```

Open http://127.0.0.1:4173. The preview binds only to the local loopback interface.
Source changes rebuild automatically; refresh the browser to see them. Use `PORT=4174
npm run dev` if the port is occupied. Stop the preview with Ctrl+C.

`npm run build` bundles the client and renders the design into `_preview/`.
`npm test` checks publication metadata, content integrity, and build output.
With the preview running, `npm run test:browser` runs desktop/mobile, real WebGL,
camera interaction, dialogs, citation copy, filters, academic mode, reduced motion,
WebGL failure, and no-JavaScript checks. Screenshots go to ignored `test-results/`.

The preview uses LiquidJS to render the **same** Jekyll layout and Markdown collections.
It is deliberately scoped to the redesigned homepage, its about aliases, notes, and
photo stories; it is not a replacement for the full Jekyll site's legacy routes.
Before a future deployment, also run the full Ruby/Jekyll build and check those routes.
Nothing in these npm commands deploys or pushes the website.

## Design

Warm paper, sage, clay, and blue; editorial typography; a compact architectural model
instead of a full-screen game. The first screen introduces the researcher immediately.
Normal HTML holds all important academic information. Three.js is an optional entrance
to the same material, loaded separately only when the neighborhood comes into view.

| District         | Physical scene                                | Destination                                     |
| ---------------- | --------------------------------------------- | ----------------------------------------------- |
| Agents Quarter   | Two studios, communication dish, small robots | In-workspace personal note (initially blank)     |
| Embodied Lab     | Manipulator workbench, robot, memory rack     | In-workspace personal note (initially blank)     |
| The Workshop     | Crane, exposed beams, barriers                | In-workspace personal note (initially blank)     |
| The Reading Room | Lamp, chair, three pickable books             | Small notebook selector, then notebook contents |
| The Photo Wall   | A small freestanding exhibition wall          | Small photo preview, then full Photos section   |

Drag to orbit, pinch or use +/− to zoom, click a building/label to select a district.
Buildings, labels, books, and picture frames open a small non-modal window inside
the workspace. Photo previews require a second click to visit the full Photos section;
notebook previews require a second click to open a notebook. No research-paper jump
links are shown in these windows. Close with × or Escape; keyboard focus returns to
the opener. Opening animations respect reduced-motion preferences.
Use the light switch for evening, pause for stillness, and reset to restore the camera.
Camera and scene updates stop offscreen / in background tabs. Reduced-motion preferences
start the world paused. Academic view hides the world, shows all seven listed papers, and
persists locally. No CDN or external font requests are needed for the page or scene.

## Where to maintain content

- `_config.yml`: public email, Scholar, GitHub, site metadata.
- `_pages/about.md`: existing biography source; the new homepage uses the composed
  biography in `_layouts/research-home.html`. Keep them consistent when updating it.
- `_publications/*.md`: the publication records, with added `slug`,
  `short_title`, `research_area`, `selected`, `display_venue`, `authors`, and `bibtex`.
  `bibtex` is a YAML multiline string used by the Cite dialog. Summaries are not displayed.
- `_data/studio.yml`: district text, paper mappings, notebook names. Fill a district's
  `description` to add your personal motivation paragraph; Agents, Embodied, and
  In progress start blank. Use `description: |` with indented lines for longer text.
- `_notes/`: real Markdown notes. The README includes front matter and book categories.
- `_photo_stories/`: real photo blogs. Its README includes the front matter format.
- `_layouts/research-home.html`: homepage composition and education/experience.
- `_layouts/studio-entry.html`: note and photo-story reading page.
- `src/world.js`: procedural world models, rendering, camera, interaction.
- `src/main.js`: filtering, dialogs, clipboard, progressive enhancement.
- `assets/css/home.css`: responsive styling, adapted from WowPage.

`assets/js/studio/` is generated and committed so the existing branch-based GitHub
Pages Jekyll build can serve Three.js without an npm step. Before committing changes
to `src/` or dependencies, run `npm ci && npm run build:js`, then commit the generated
assets alongside the sources. The build removes obsolete generated world chunks.
Changes to Markdown, YAML, CSS, and templates are handled by Jekyll on publication.
The publishing source remains `master`; no repository Pages settings were changed.

## Content boundaries

Publication details and BibTeX follow the user's supplied records. World Action Agent
was added as a preprint; its September 24, 2026 submission date is from its arXiv page.
IEEE Access PCSA is excluded as requested. DALFNet is retained in source with
`published: false` and excluded from the site. All papers is the default clean text
list with seven papers.
Selected contains only Orchestrating Audio, VideoMemory, and WorldLines with thumbnails.
No topic filters or overview dialogs are displayed. District windows do not filter
or jump to papers. Cite opens copyable BibTeX, not a prose citation.
WorldLines displays EMNLP 2026 as requested, while its Cite entry retains the
user-specified arXiv `@misc` record. Original citation keys, field values, author
order, and optional fields are preserved; pasted Markdown URL wrappers are removed.
`scripts/fixtures/approved-citations.json` holds the supplied citations for regression
checks; both data tests and browser clipboard tests compare all seven entries exactly.
The three selected papers' full author names were checked against ACL/arXiv.
Paper-card illustrations are conceptual graphics, not reproduced paper figures.
The profile keeps the first-year PhD, Ying-Cong Chen (PhD and MPhil), and Knowin AI
internship details from the existing homepage.

No blog posts, locations, publication metrics, awards, or unreleased project details
were invented. Notebooks are clearly empty. Photos uses the two user-supplied images
in `assets/images/riverside-night.jpg` and `assets/images/aircraft-formation.jpg`,
with uncropped previews and click-to-enlarge dialogs. The profile avatar is unchanged
and is no longer reused in Photos. Legacy
Academic Pages sample posts are not pulled into this redesign.

## Next editorial pass

Replace the empty notebook shelves with actual learning notes. Add photo stories
when available. Decide what ongoing project names can be public. Add verified code
and project-site links or real paper thumbnails when available. The current prototype
contains complete interactions so these choices can be made while exploring the page.

Template source and license: `THIRD_PARTY_NOTICES.md`. Original site license: `LICENSE`.
