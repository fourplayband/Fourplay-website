import fs from 'fs/promises';
import path from 'path';

const PHOTOS_DIR = path.resolve(process.cwd(), 'content', 'photos');

function isJsonFile(name){ return name && name.toLowerCase().endsWith('.json'); }

async function readJson(file){
  try{ const txt = await fs.readFile(file, 'utf8'); return JSON.parse(txt); }
  catch(e){ console.warn('Failed to read/parse', file, e.message); return null; }
}

function normalizeImageItem(item){
  if(!item) return null;
  if(typeof item === 'string') return { image: item, caption: '' };
  const image = item.image || item.url || item.src || item.path || null;
  const caption = item.caption || item.title || '';
  if(!image) return null;
  return { image, caption };
}

async function buildYear(folderName){
  const folderPath = path.join(PHOTOS_DIR, folderName);
  const stat = await fs.stat(folderPath).catch(()=>null);
  if(!stat || !stat.isDirectory()) return { wrote: false, reason: 'not a directory' };

  const entries = await fs.readdir(folderPath, { withFileTypes: true }).catch(()=>[]);
  const files = entries.filter(e => e.isFile() && isJsonFile(e.name)).map(e => e.name).sort();

  const galleries = [];
  let thumbnail = null;

  for(const file of files){
    const full = path.join(folderPath, file);
    const data = await readJson(full);
    if(!data) continue;
    const title = data.title || path.basename(file, '.json');
    const section = data.section || 'gig-photos';
    const raw = Array.isArray(data.images) ? data.images : (Array.isArray(data.photos) ? data.photos : []);
    const images = raw.map(normalizeImageItem).filter(Boolean);
    if(images.length === 0) continue;
    const entryThumb = data.thumbnail || data.cover || (images[0] && images[0].image) || null;
    if(!thumbnail && entryThumb) thumbnail = entryThumb;
    galleries.push({ section, title, images });
  }

  if(galleries.length === 0){ console.log(`[photos] skipping ${folderName} — no valid images`); return { wrote: false }; }

  const out = { year: folderName, galleries };
  if(thumbnail) out.thumbnail = thumbnail;

  const outPath = path.join(PHOTOS_DIR, `${folderName}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[photos] wrote ${path.relative(process.cwd(), outPath)}`);
  return { wrote: true };
}

async function main(){
  console.log('[photos] build starting —', PHOTOS_DIR);
  const entries = await fs.readdir(PHOTOS_DIR, { withFileTypes: true }).catch(err=>{ console.error('[photos] cannot read photos dir', err.message); process.exit(2); });
  const folders = entries.filter(e=>e.isDirectory()).map(d=>d.name);
  if(folders.length === 0){ console.log('[photos] no folders found'); return; }
  for(const f of folders){ try{ await buildYear(f); }catch(e){ console.error('[photos] error', f, e); } }
  // Build index.json summarizing available years
  try{
    const years = [];
    for(const f of folders){
      const mergedPath = path.join(PHOTOS_DIR, `${f}.json`);
      const stat = await fs.stat(mergedPath).catch(()=>null);
      if(!stat) continue;
      const data = await readJson(mergedPath);
      const cover = (data && data.thumbnail) ? data.thumbnail : '';
      years.push({ slug: f, label: f, cover });
    }
    const indexOut = { years };
    const indexPath = path.join(PHOTOS_DIR, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(indexOut, null, 2), 'utf8');
    console.log(`[photos] wrote index ${path.relative(process.cwd(), indexPath)}`);
  }catch(e){ console.warn('[photos] failed to write index.json', e); }

  console.log('[photos] build complete');
}

main().catch(err=>{ console.error('[photos] fatal', err); process.exit(1); });
