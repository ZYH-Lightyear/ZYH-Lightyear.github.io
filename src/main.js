// WowPage's selected/full-publication pattern, extended with research districts.
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const studio = JSON.parse($("#studio-data").textContent);
const entries = JSON.parse($("#notebook-entries").textContent);
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const cards = $$(".publication-card");
const dialog = $("#content-dialog");
const content = $("#dialog-content");
const workspacePopover = $("#workspace-popover");
let workspaceOpener, workspaceAnimation;
let world = null,
  loading = false,
  selectedDistrict = null;
let paused = motionPreference.matches,
  evening = false,
  academic = false;
let toastTimer, lastFocused;
try {
  academic = localStorage.getItem("yehang-academic-view") === "true";
} catch {
  /* Storage is optional. */
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}
function filterPublications(type) {
  $("#paper-list").classList.toggle("selected-view", type === "selected");
  let count = 0;
  for (const card of cards) {
    const show = type === "all" || card.dataset.selected === "true";
    card.hidden = !show;
    if (show) count++;
  }
  $$(".pub-button").forEach((button) => {
    const active = button.dataset.filter === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#research-count").textContent =
    `${count} ${count === 1 ? "paper" : "papers"}`;
  $("#filter-note").hidden = count !== 0;
}
$$(".pub-button").forEach((button) =>
  button.addEventListener("click", () =>
    filterPublications(button.dataset.filter),
  ),
);
filterPublications("all");

function closeWorkspacePopover(restoreFocus = true) {
  if (workspacePopover.hidden) return;
  workspaceAnimation?.cancel();
  workspacePopover.hidden = true;
  selectedDistrict = null;
  $$(".district-tab, .world-hotspot").forEach(button => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-expanded", "false");
  });
  world?.select(null, false);
  if (restoreFocus) workspaceOpener?.focus({ preventScroll: true });
}
$("#close-workspace-popover").addEventListener("click", () => closeWorkspacePopover());
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !dialog.open && !workspacePopover.hidden) {
    event.preventDefault();
    closeWorkspacePopover();
  }
});

function selectDistrict(id) {
  const district = studio.districts.find((item) => item.id === id);
  if (!district) return;
  if (!workspacePopover.contains(document.activeElement)) {
    workspaceOpener = document.activeElement?.matches(".district-tab, .world-hotspot")
      ? document.activeElement
      : $(`.district-tab[data-district="${id}"]`);
  }
  selectedDistrict = id;
  $$(".district-tab, .world-hotspot").forEach((button) => {
    const active = button.dataset.district === id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-expanded", String(active));
  });
  $("#district-title").textContent = district.name;
  const note = $("#district-description");
  note.textContent = district.description || "";
  note.hidden = !district.description && ["gallery", "notes"].includes(id);
  const preview = $("#workspace-preview");
  preview.replaceChildren();
  if (id === "gallery") {
    const strip = document.createElement("a");
    strip.href = "#gallery";
    strip.className = "workspace-photo-preview";
    strip.setAttribute("aria-label", "View all photos");
    $$(".photo-card").forEach(card => {
      const figure = document.createElement("figure");
      const image = card.querySelector("img").cloneNode(true);
      image.alt = "";
      image.removeAttribute("loading");
      const caption = document.createElement("figcaption");
      caption.textContent = card.dataset.photoTitle;
      figure.append(image, caption);
      strip.append(figure);
    });
    const label = document.createElement("span");
    label.className = "workspace-preview-link";
    label.textContent = "View all photos ↗";
    strip.append(label);
    strip.addEventListener("click", () => {
      closeWorkspacePopover(false);
      // Transfer keyboard focus to the destination, without scrolling until the anchor resolves.
      $(".photo-card")?.focus({ preventScroll: true });
    });
    preview.append(strip);
  } else if (id === "notes") {
    const shelf = document.createElement("div");
    shelf.className = "workspace-notebooks";
    for (const notebook of studio.notebooks) {
      const button = document.createElement("button");
      button.textContent = `${notebook.title} ↗`;
      button.dataset.previewNotebook = notebook.id;
      button.addEventListener("click", () => openNotebook(notebook.id));
      shelf.append(button);
    }
    preview.append(shelf);
  }
  workspacePopover.hidden = false;
  workspacePopover.dataset.district = id;
  workspacePopover.style.setProperty("--popover-accent", district.color);
  workspaceAnimation?.cancel();
  if (!motionPreference.matches) {
    workspaceAnimation = workspacePopover.animate(
      [{ opacity: 0, transform: "translateY(12px) scale(.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
      { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }
  world?.select(id);
  $("#close-workspace-popover").focus({ preventScroll: true });
}
$$(".district-tab").forEach((button) =>
  button.addEventListener("click", () =>
    selectDistrict(button.dataset.district),
  ),
);

function showDialog(kind, fragment) {
  lastFocused = document.activeElement;
  $("#dialog-kind").textContent = kind;
  content.replaceChildren(fragment);
  const heading = content.querySelector("h2");
  if (heading) heading.id = "dialog-title";
  dialog.showModal();
  document.body.style.overflow = "hidden";
  // Stop offscreen work and motion behind the reading surface.
  world?.pause(true);
  $("#close-dialog").focus();
}
function closeDialog() {
  dialog.close();
}
$("#close-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [
    ...dialog.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex="0"]',
    ),
  ].filter((node) => node.getClientRects().length);
  const first = focusable[0],
    last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
dialog.addEventListener("close", () => {
  document.body.style.overflow = "";
  world?.pause(paused || academic);
  lastFocused?.focus({ preventScroll: true });
});
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    closeDialog();
});
async function copyCitation(button) {
  const text = content.querySelector(".citation-text").textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied ✓";
    toast("BibTeX copied to clipboard.");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(content.querySelector(".citation-text"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = "BibTeX selected — press ⌘C / Ctrl+C";
  }
}
function openCitation(id) {
  const template = $(`#data-${id}`);
  if (!template) return;
  showDialog(
    "BibTeX",
    template.content.cloneNode(true),
  );
  content
    .querySelector(".copy-citation")
    .addEventListener("click", (event) => copyCitation(event.currentTarget));
}
$$("[data-cite]").forEach((button) =>
  button.addEventListener("click", () => openCitation(button.dataset.cite)),
);

function openNotebook(id) {
  const book = studio.notebooks.find((item) => item.id === id);
  if (!book) return;
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.textContent = book.title;
  const subtitle = document.createElement("p");
  subtitle.textContent = book.subtitle;
  fragment.append(heading, subtitle);
  const notes = entries.filter((item) => item.notebook === id);
  if (notes.length) {
    const list = document.createElement("div");
    list.className = "entry-list";
    for (const note of notes) {
      const a = document.createElement("a");
      a.href = note.url;
      a.textContent = `${note.title} ↗`;
      list.append(a);
    }
    fragment.append(list);
  } else {
    const empty = document.createElement("div");
    empty.className = "notebook-empty";
    empty.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#i-book"/></svg><strong>The first page is still blank.</strong><p>This notebook is reserved for future readings and learning notes. No entries have been published yet.</p>';
    fragment.append(empty);
  }
  showDialog("THE READING ROOM / NOTEBOOK", fragment);
}
$$("[data-notebook]").forEach((button) =>
  button.addEventListener("click", () => openNotebook(button.dataset.notebook)),
);
function openPhoto(id) {
  const card = $$(".photo-card").find(item => item.dataset.photo === id);
  if (!card) return;
  const fragment = document.createDocumentFragment();
  const title = document.createElement("h2");
  title.textContent = card.dataset.photoTitle;
  const image = card.querySelector("img").cloneNode(true);
  image.className = "dialog-photo";
  image.removeAttribute("loading");
  fragment.append(title, image);
  showDialog("Photos", fragment);
}
$$("[data-photo]").forEach((button) =>
  button.addEventListener("click", () => openPhoto(button.dataset.photo)),
);

function updateMotionButton() {
  $("#motion-toggle").setAttribute("aria-pressed", String(paused));
  $("#motion-toggle").setAttribute(
    "aria-label",
    paused ? "Resume world animation" : "Pause world animation",
  );
  $("#motion-toggle").title = paused ? "Resume animation" : "Pause animation";
  $("#motion-symbol").textContent = paused ? "▷" : "Ⅱ";
}
updateMotionButton();
motionPreference.addEventListener("change", (event) => {
  paused = event.matches;
  world?.pause(paused || academic || dialog.open);
  updateMotionButton();
});
$("#motion-toggle").addEventListener("click", () => {
  paused = !paused;
  updateMotionButton();
  world?.pause(paused);
});
$("#light-toggle").addEventListener("click", () => {
  evening = !evening;
  $("#world-frame").classList.toggle("evening", evening);
  $("#light-toggle").setAttribute("aria-pressed", String(evening));
  $("#light-toggle").setAttribute(
    "aria-label",
    evening ? "Switch to daylight lighting" : "Switch to evening lighting",
  );
  $("#light-toggle span").textContent = evening ? "Evening" : "Daylight";
  world?.evening(evening);
});
$("#reset-view").addEventListener("click", () => {
  closeWorkspacePopover(false);
  world?.reset();
  toast("Back to the neighborhood.");
});
$("#zoom-in").addEventListener("click", () => world?.zoom(0.15));
$("#zoom-out").addEventListener("click", () => world?.zoom(-0.15));

function applyView() {
  document.body.classList.toggle("academic-mode", academic);
  $("#academic-toggle").setAttribute("aria-pressed", String(academic));
  $("#academic-toggle span").textContent = academic
    ? "Explore the world"
    : "Academic view";
  if (academic) {
    closeWorkspacePopover(false);
    filterPublications("all");
  }
  world?.pause(paused || academic);
}
applyView();
$("#academic-toggle").addEventListener("click", () => {
  academic = !academic;
  try {
    localStorage.setItem("yehang-academic-view", String(academic));
  } catch {
    /* Ignore unavailable storage. */
  }
  applyView();
  if (!academic) loadWorld();
});
function worldUnavailable() {
  world?.dispose();
  world = null;
  $("#world-fallback").hidden = false;
  $("#world-fallback p").textContent = "Explore at your own pace.";
  $("#world-fallback>span").textContent =
    "3D is unavailable here. All districts and papers still work below.";
  $("#load-world").textContent = "Try 3D again ↗";
}
$("#world-canvas").addEventListener("world-unavailable", worldUnavailable);
async function loadWorld() {
  if (loading || world || academic) return;
  loading = true;
  $("#load-world").disabled = true;
  $("#load-world").textContent = "Building the neighborhood…";
  try {
    const { createWorld } = await import("./world.js");
    world = createWorld({
      host: $("#world-canvas"),
      labels: $("#world-labels"),
      compass: $("#world-compass"),
      districts: studio.districts,
      onSelect: selectDistrict,
      onBook: () => selectDistrict("notes"),
      onPhoto: () => selectDistrict("gallery"),
      reducedMotion: motionPreference.matches,
    });
    world.select(selectedDistrict, false);
    world.pause(paused || academic);
    world.evening(evening);
    $("#world-fallback").hidden = true;
  } catch (error) {
    // A canvas failure must never prevent access to the research content.
    console.warn(
      "Research neighborhood is in accessible 2D mode:",
      error.message,
    );
    worldUnavailable();
  } finally {
    loading = false;
    $("#load-world").disabled = false;
  }
}
$("#load-world").addEventListener("click", loadWorld);
const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting && !academic) {
      loadWorld();
      observer.disconnect();
    }
  },
  { rootMargin: "150px" },
);
observer.observe($("#world-frame"));
function revealLinkedPaper() {
  if (location.hash.startsWith("#paper-")) {
    const card = document.getElementById(location.hash.slice(1));
    if (card?.classList.contains("publication-card")) {
      filterPublications("all");
      card.scrollIntoView();
    }
  }
}
window.addEventListener("hashchange", revealLinkedPaper);
revealLinkedPaper();
window.addEventListener("pagehide", () => world?.pause(true));
window.addEventListener("pageshow", () => world?.pause(paused || academic));
