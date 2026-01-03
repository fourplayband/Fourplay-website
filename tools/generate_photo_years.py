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
    else:
        # no galleries for this year; do not overwrite existing master
        pass

print('Done')
