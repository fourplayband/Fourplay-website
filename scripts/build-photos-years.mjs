// scripts/build-photos-years.mjs
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const PHOTOS_DIR = path.join(ROOT, "content", "photos");

const isJson = (name) => name.toLowerCase().endsWith(".json");

async function readJson(filePath) {
  try {
    const txt = await fs.readFile(filePath, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    console.warn("[photos] skip invalid json:", filePath, e.message);
    return null;
  }
}

function normalizeImageItem(item) {
  if (!item) return null;
  const image = item.image || item.url || item.src || item.path || null;
  if (!image) return null;
  return {
    image,
    caption: item.caption || item.title || item.alt || ""
  };
}

function normalizeSection(value) {
  if (!value) return "gig-photos";
  const normalized = String(value).toLowerCase().replace(/[_\s]/g, "").replace(/–/g, "-");
  return normalized.includes("poster") ? "posters" : "gig-photos";
}

function extractFolderSlug(filePath) {
  const parent = path.basename(path.dirname(filePath));
  if (!parent) return null;
  const normalized = String(parent).trim();
  if (/^(20\d{2})([–-](20\d{2}))?$/.test(normalized)) return normalized;
  return null;
}

function normalizeRawEntry(entry, filePath) {
  if (!entry || typeof entry !== "object") return null;
  const image = entry.image || entry.url || entry.src || entry.path || null;
  if (!image) return null;
  const title = entry.title || entry.caption || entry.name || path.basename(filePath).replace(/\.json$/i, "");
  return {
    image,
    caption: entry.caption || entry.title || title,
    title,
    section: normalizeSection(entry.section || entry.category),
    date: entry.date || null,
    folderSlug: extractFolderSlug(filePath)
  };
}

async function collectRawEntries(dir) {
  const entries = [];
  const dirents = await fs.readdir(dir, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      entries.push(...await collectRawEntries(fullPath));
      continue;
    }

    if (!dirent.isFile() || !isJson(dirent.name)) continue;
    if (dirent.name === "index.json" || dirent.name === "photos.json") continue;

    const json = await readJson(fullPath);
    if (!json || typeof json !== "object") continue;

    // Skip existing master files at the top level or generated outputs
    if (json.galleries || json.entries) {
      continue;
    }

    const normalized = normalizeRawEntry(json, fullPath);
    if (!normalized || !normalized.folderSlug) continue;
    entries.push(normalized);
  }

  return entries;
}

async function writeYearJson(slug, label, sections) {
  const galleries = [];
  for (const [section, images] of sections.entries()) {
    galleries.push({
      section,
      title: section === "posters" ? `${label} Posters` : `${label} Gig Photos`,
      images
    });
  }

  const out = {
    year: slug,
    ...(galleries.length ? { galleries } : {}),
    ...(galleries.length && galleries[0].images.length ? { thumbnail: galleries[0].images[0].image } : {})
  };

  const outPath = path.join(PHOTOS_DIR, `${slug}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[photos] wrote ${path.relative(ROOT, outPath)} (${galleries.length} gallery section(s))`);
}

async function writeFolderIndex(slug, entries) {
  const folderPath = path.join(PHOTOS_DIR, slug);
  await fs.mkdir(folderPath, { recursive: true });

  const manifest = {
    year: slug,
    entries
  };

  const outPath = path.join(folderPath, "index.json");
  await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[photos] wrote ${path.relative(ROOT, outPath)} (${entries.length} entries)`);
}

async function buildFromIndex(yearsIndex, rawEntries) {
  for (const item of yearsIndex) {
    const slug = String(item.slug || item.year || item.id || "").trim();
    if (!slug) continue;
    const label = String(item.label || item.year || item.id || slug);
    const filtered = rawEntries.filter((entry) => entry.folderSlug === slug);

    const sections = new Map();
    const folderIndexEntries = [];

    filtered.forEach((entry) => {
      const section = entry.section || "gig-photos";
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section).push({
        image: entry.image,
        caption: entry.caption,
        title: entry.title,
        ...(entry.date ? { date: entry.date } : {})
      });

      folderIndexEntries.push({
        title: entry.title,
        image: entry.image,
        ...(entry.date ? { date: entry.date } : {})
      });
    });

    await writeYearJson(slug, label, sections);
    await writeFolderIndex(slug, folderIndexEntries);
  }
}

async function buildOneYearFolder(folderName) {
  const folderPath = path.join(PHOTOS_DIR, folderName);
  const dirents = await fs.readdir(folderPath, { withFileTypes: true });

  const entryFiles = dirents
    .filter((d) => d.isFile() && isJson(d.name) && d.name !== "index.json")
    .map((d) => d.name)
    .sort();

  const galleryImages = [];
  const entries = [];
  let thumbnail = null;

  for (const fileName of entryFiles) {
    const fullPath = path.join(folderPath, fileName);
    const entry = await readJson(fullPath);
    if (!entry) continue;

    const image = entry.image || entry.url || entry.src || entry.path || null;
    if (!image) continue;

    const title = entry.title || entry.caption || entry.name || fileName.replace(/\.json$/i, "");
    const normalizedEntry = {
      title,
      image,
      ...(entry.date ? { date: entry.date } : {})
    };
    entries.push(normalizedEntry);
    galleryImages.push({
      image,
      caption: title,
      title,
      ...(entry.date ? { date: entry.date } : {})
    });

    if (!thumbnail) {
      thumbnail = entry.thumbnail || entry.cover || image || null;
    }
  }

  const manifest = {
    year: folderName,
    entries
  };

  const manifestPath = path.join(folderPath, "index.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const galleries = galleryImages.length
    ? [{
        section: "cms-entries",
        title: `${folderName} Photos`,
        images: galleryImages
      }]
    : [];

  const out = {
    year: folderName,
    galleries,
    ...(thumbnail ? { thumbnail } : {})
  };

  const outPath = path.join(PHOTOS_DIR, `${folderName}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[photos] wrote ${path.relative(ROOT, outPath)} (${galleries.length} gallery section(s))`);
}

async function main() {
  let dirents;
  try {
    dirents = await fs.readdir(PHOTOS_DIR, { withFileTypes: true });
  } catch (e) {
    console.error("[photos] content/photos not found:", PHOTOS_DIR);
    process.exit(1);
  }

  const folders = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

  const indexJson = await readJson(path.join(PHOTOS_DIR, "index.json"));
  const rawEntries = await collectRawEntries(PHOTOS_DIR);

  if (indexJson && Array.isArray(indexJson.years) && indexJson.years.length) {
    await buildFromIndex(indexJson.years, rawEntries);
  } else {
    if (!folders.length) {
      console.log("[photos] no year folders found under content/photos/");
      return;
    }

    for (const folderName of folders) {
      try {
        await buildOneYearFolder(folderName);
      } catch (e) {
        console.error("[photos] build error for", folderName, e);
      }
    }
  }

  console.log("[photos] build complete");
}

main();
