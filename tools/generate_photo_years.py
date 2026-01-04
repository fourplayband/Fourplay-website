#!/usr/bin/env python3
"""
Scan content/photos and subfolders for single-photo JSON entries and generate
master per-year files at content/photos/<year>.json in the format expected by
photos.html (fields: year, galleries: [{section,title,images:[{image,caption}]}]).
"""
import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(__file__))
PHOTOS_DIR = os.path.join(ROOT, 'content', 'photos')
YEARS = list(range(2016, 2027))

# read hub index if present to determine desired hub slugs (e.g. "2020-2021")
def read_hub_index():
    idx_path = os.path.join(PHOTOS_DIR, 'index.json')
    try:
        with open(idx_path, 'r', encoding='utf-8') as f:
            j = json.load(f)
            return j.get('years') if isinstance(j, dict) else None
    except Exception:
        return None

def read_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def determine_year_from_entry(fname, data):
    # 1) check data.date if present and looks like YYYY or YYYY-MM
    if isinstance(data, dict):
        date = data.get('date')
        if isinstance(date, str):
            m = re.match(r"^(20\d{2})", date)
            if m:
                return int(m.group(1))
    # 2) try filename
    m = re.search(r"(20\d{2})", fname)
    if m:
        return int(m.group(1))
    return None

def normalize_section(cat):
    if not cat: return 'gig-photos'
    v = cat.lower().replace(' ', '').replace('_','').replace('-','')
    if 'poster' in v: return 'posters'
    return 'gig-photos'

# collect single-image entries
entries_by_year_section = defaultdict(lambda: defaultdict(list))

for dirpath, dirnames, filenames in os.walk(PHOTOS_DIR):
    for fn in filenames:
        if not fn.lower().endswith('.json'):
            continue
        full = os.path.join(dirpath, fn)
        # skip master files that are already in the expected format
        if os.path.abspath(full) == os.path.abspath(os.path.join(PHOTOS_DIR, fn)):
            # top-level files like 2016.json will be handled later; still read to merge
            pass
        data = read_json(full)
        if data is None:
            continue
        # detect if this file is already a master (has 'galleries')
        if isinstance(data, dict) and 'galleries' in data:
            # ensure year key exists
            y = data.get('year')
            if isinstance(y, int) and y in YEARS:
                # keep existing galleries as-is
                for g in data.get('galleries', []):
                    section = normalize_section(g.get('section'))
                    # convert images inside
                    for img in g.get('images', []):
                        src = img.get('image') or img.get('src') or img.get('url')
                        caption = img.get('caption') or img.get('title') or ''
                        if src:
                            entries_by_year_section[y][section].append({'image': src, 'caption': caption})
            continue
        # otherwise treat as single-photo entry
        # expect fields like image or src, category or title, date
        year = determine_year_from_entry(fn, data) or determine_year_from_entry(fn, {})
        if year is None:
            # if file is under a folder like '2016-2019', try parent folder name
            parent = os.path.basename(dirpath)
            m = re.search(r"(20\d{2})", parent)
            if m:
                year = int(m.group(1))
        if year is None:
            # fallback: check image path
            img_path = data.get('image') or data.get('src') or data.get('url')
            if isinstance(img_path, str):
                m = re.search(r"(20\d{2})", img_path)
                if m:
                    year = int(m.group(1))
        if year is None:
            continue
        if year not in YEARS:
            continue
        img = data.get('image') or data.get('src') or data.get('url')
        caption = data.get('title') or data.get('caption') or ''
        cat = data.get('category') or data.get('section') or ''
        section = normalize_section(cat)
        if img:
            entries_by_year_section[year][section].append({'image': img, 'caption': caption})

# write master files
hub_index = read_hub_index()
if hub_index and isinstance(hub_index, list) and len(hub_index):
    # build per-hub aggregated files
    for hub in hub_index:
        slug = str(hub.get('year') or hub.get('slug') or hub.get('id') or '')
        label = str(hub.get('label') or slug)
        if not slug:
            continue
        # determine years covered by this hub
        years_to_include = []
        m = re.match(r"^(20\d{2})-(20\d{2})$", slug)
        if m:
            start = int(m.group(1)); end = int(m.group(2))
            years_to_include = [y for y in YEARS if y >= start and y <= end]
        else:
            # single-year hub (e.g. '2025') or non-numeric slug
            m2 = re.match(r"^(20\d{2})$", slug)
            if m2:
                years_to_include = [int(m2.group(1))]
            else:
                # unknown slug: try to include all YEARS whose folder name matches the slug
                years_to_include = []

        galleries = []
        # gather posters then gig-photos across years in order
        posters = []
        gigs = []
        for y in years_to_include:
            posters.extend(entries_by_year_section[y].get('posters', []))
            gigs.extend(entries_by_year_section[y].get('gig-photos', []))

        if posters:
            galleries.append({'section': 'posters', 'title': f'{label} Posters', 'images': posters})
        if gigs:
            galleries.append({'section': 'gig-photos', 'title': f'{label} Gig Photos', 'images': gigs})

        if galleries:
            out = {'slug': slug, 'label': label, 'galleries': galleries}
            outpath = os.path.join(PHOTOS_DIR, f'{slug}.json')
            try:
                with open(outpath, 'w', encoding='utf-8') as f:
                    json.dump(out, f, indent=2)
                print(f'Wrote {outpath}')
            except Exception as e:
                print('Failed to write', outpath, e)
else:
    # legacy behavior: write per-year master files for numeric years
    for y in YEARS:
        galleries = []
        # posters first
        if entries_by_year_section[y].get('posters'):
            galleries.append({
                'section': 'posters',
                'title': f'{y} Posters',
                'images': entries_by_year_section[y]['posters']
            })
        if entries_by_year_section[y].get('gig-photos'):
            galleries.append({
                'section': 'gig-photos',
                'title': f'{y} Gig Photos',
                'images': entries_by_year_section[y]['gig-photos']
            })
        if galleries:
            out = {'year': y, 'galleries': galleries}
            outpath = os.path.join(PHOTOS_DIR, f'{y}.json')
            try:
                with open(outpath, 'w', encoding='utf-8') as f:
                    json.dump(out, f, indent=2)
                print(f'Wrote {outpath}')
            except Exception as e:
                print('Failed to write', outpath, e)

print('Done')
