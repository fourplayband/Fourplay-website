#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const PHOTOS_DIR = path.join(ROOT, 'content', 'photos');

function isJson(name){ return String(name).toLowerCase().endsWith('.json'); }

async function readJson(p){ try{ const txt = await fs.readFile(p,'utf8'); return JSON.parse(txt);}catch(e){return null;} }

function determineYear(entry, filePath){
  if(entry && typeof entry === 'object'){
    const date = typeof entry.date === 'string' ? entry.date : null;
    if(date){ const m = date.match(/^(20\d{2})/); if(m) return Number(m[1]); }
    const fname = path.basename(filePath);
    let m = fname.match(/(20\d{2})/);
    if(m) return Number(m[1]);
    const parent = path.basename(path.dirname(filePath));
    m = parent.match(/(20\d{2})/);
    if(m) return Number(m[1]);
    const img = entry.image || entry.url || entry.src || entry.path || '';
    if(typeof img === 'string'){ m = img.match(/(20\d{2})/); if(m) return Number(m[1]); }
  }
  return null;
}

async function readHubIndex(){
  const idx = await readJson(path.join(PHOTOS_DIR,'index.json'));
  if(!idx || !Array.isArray(idx.years)) return [];
  return idx.years.map(y=>({ slug: String(y.slug||y.year||y.id||''), label: String(y.label||y.year||y.id||'' ) }));
}

function mapYearToSlug(year, hubYears){
  if(!year) return null;
  for(const h of hubYears){
    const s = String(h.slug||'');
    const range = s.match(/^(20\d{2})[–-](20\d{2})$/);
    if(range){ const start = Number(range[1]), end = Number(range[2]); if(year>=start && year<=end) return s; }
    const single = s.match(/^(20\d{2})$/);
    if(single && Number(single[1])===year) return s;
  }
  return String(year);
}

async function collectEntryFiles(dir){
  const results=[];
  const dirents = await fs.readdir(dir,{withFileTypes:true});
  for(const d of dirents){
    const p = path.join(dir,d.name);
    if(d.isDirectory()){
      results.push(...await collectEntryFiles(p));
      continue;
    }
    if(!d.isFile() || !isJson(d.name)) continue;
    // skip master files
    if(['index.json','photos.json'].includes(d.name)) continue;
    const j = await readJson(p);
    if(!j || typeof j !== 'object') continue;
    if(j.galleries || j.entries) continue; // skip pre-made masters
    results.push({ path: p, json:j });
  }
  return results;
}

async function ensureDir(p){ try{ await fs.mkdir(p,{recursive:true}); }catch(e){} }

async function main(){
  console.log('Scanning photo entries...');
  const hub = await readHubIndex();
  const entries = await collectEntryFiles(PHOTOS_DIR);
  console.log(`Found ${entries.length} entry files.`);

  for(const e of entries){
    const yr = determineYear(e.json, e.path);
    const targetSlug = mapYearToSlug(yr, hub) || 'unknown';
    const targetDir = path.join(PHOTOS_DIR, targetSlug);
    const fileName = path.basename(e.path);
    const targetPath = path.join(targetDir, fileName);
    if(path.resolve(path.dirname(e.path)) === path.resolve(targetDir)){
      // already in correct folder
      continue;
    }
    await ensureDir(targetDir);
    try{
      await fs.rename(e.path, targetPath);
      console.log(`Moved ${path.relative(ROOT,e.path)} -> ${path.relative(ROOT,targetPath)}`);
    }catch(err){
      console.error('Failed to move', e.path, '->', targetPath, err.message);
    }
  }

  console.log('Done moving files. You should run your photo build script to regenerate manifests (npm run build:photos).');
}

main().catch(err=>{ console.error(err); process.exit(1); });
