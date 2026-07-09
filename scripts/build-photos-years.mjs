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

function entryToGallery(entry, fallbackTitle) {
  const title = entry?.title || entry?.name || fallbackTitle || "Gallery";
  const section = entry?.section || "gig-photos";

  const arr = Array.isArray(entry?.images)
    ? entry.images
    : Array.isArray(entry?.photos)
      ? entry.photos
      : [];

  const images = arr.map(normalizeImageItem).filter(Boolean);
  return { section, title, images };
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

    // thumbnail: entry.thumbnail/cover first, else first image found
    if (!thumbnail) {
      thumbnail =
        entry.thumbnail ||
        entry.cover ||
        image ||
        null;
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
  // Ensure content/photos exists
  let dirents;
  try {
    dirents = await fs.readdir(PHOTOS_DIR, { withFileTypes: true });
  } catch (e) {
    console.error("[photos] content/photos not found:", PHOTOS_DIR);
    process.exit(1);
  }

  // Only scan subfolders (years and ranged-years)
  const folders = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

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

  console.log("[photos] build complete");
}

main();
