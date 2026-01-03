// photos.js — shared logic for photos Year Hub and Year Gallery + Lightbox
(() => {
  const PRIORITY_ORDER = ["2026","2025","2024","2023","2022","2020-2021","2016-2019"];

  // utility: fetch JSON with friendly fallback
  async function fetchJson(path){
    try{
      const res = await fetch(path, {cache:'no-store'});
      if(!res.ok) throw new Error('Not found');
      return await res.json();
    }catch(e){ return null; }
  }

  function normalizePhotos(data){
    if(!data) return [];
    // format A: { photos: [...] }
    if(Array.isArray(data)) return data.map(normalizePhoto);
    if(Array.isArray(data.photos)) return data.photos.map(normalizePhoto);
    // some files use 'galleries' -> images array inside; try to flatten
    if(Array.isArray(data.galleries)){
      const imgs = [];
      data.galleries.forEach(g=>{ if(Array.isArray(g.images)) imgs.push(...g.images.map(normalizePhoto)); });
      return imgs;
    }
    return [];
  }
  function normalizePhoto(p){
    if(!p) return { src:'', alt:'', caption:'' };
    if(typeof p === 'string') return { src:p, alt:'', caption:'' };
    return { src: p.image || p.src || p.url || p.path || '', alt: p.alt || p.caption || p.title || '', caption: p.caption || p.title || '' };
  }

  // YEAR HUB
  async function renderYearHub(){
    const hub = document.getElementById('yearHub');
    if(!hub) return;

    // try index.json then photos.json
    let index = await fetchJson('content/photos/index.json');
    if(!index) index = await fetchJson('content/photos/photos.json');

    let years = [];
    // If CMS-provided index.json exists, use it exactly (order and covers are CMS-managed)
    if(index && Array.isArray(index.years) && index.years.length){
      years = index.years.map(y=>({ id: String(y.year || y.id || y.label || ''), label: String(y.label || y.year || y.id || ''), cover: String(y.cover || '') }));
    }

    // if no CMS index, fallback: build from PRIORITY_ORDER by fetching each year json to get a cover
    if(years.length === 0){
      const promises = PRIORITY_ORDER.map(async id => {
        const path = `content/photos/${id}.json`;
        const json = await fetchJson(path);
        if(!json) return null;
        // cover fallback: json.thumbnail or first photo
        let cover = '';
        if(json.thumbnail) cover = json.thumbnail;
        else if(json.cover) cover = json.cover;
        else {
          const photos = normalizePhotos(json);
          if(photos.length) cover = photos[0].src;
        }
        return { id, label: id, cover };
      });
      const results = await Promise.all(promises);
      years = results.filter(Boolean);
    }

    // If we used CMS index, keep that order; otherwise order by PRIORITY_ORDER
    let ordered = [];
    if(index && Array.isArray(index.years) && index.years.length){
      ordered = years;
    } else {
      const map = new Map(years.map(y=>[y.id,y]));
      PRIORITY_ORDER.forEach(k=>{ if(map.has(k)) ordered.push(map.get(k)); map.delete(k); });
      for(const v of map.values()) ordered.push(v);
    }

    // render cards
    hub.innerHTML = '';
    ordered.forEach(y=>{
      const a = document.createElement('a');
      a.className = 'year-card' + (y.id.includes('-')||y.id.includes('–')? ' archive':'');
      if(y.id === '2026') a.classList.add('featured');
      a.href = `photos-year.html?year=${encodeURIComponent(y.id)}`;
      a.setAttribute('role','listitem');

      const img = document.createElement('img'); img.className='cover'; img.alt = y.label + ' cover'; img.loading='lazy';
      const coverUrl = (y.cover || y.thumbnail || '');
      img.src = coverUrl;
      if(coverUrl){
        img.addEventListener('error', ()=>{
          img.style.display = 'none';
          console.warn('Cover failed to load', coverUrl);
        });
      } else {
        img.style.display = 'none';
      }
      const meta = document.createElement('div'); meta.className='year-meta';
      const label = document.createElement('div'); label.className='year-label'; label.textContent = y.label || y.id;
      const sub = document.createElement('div'); sub.className='year-sub'; sub.textContent = '';
      const cta = document.createElement('div'); cta.className='year-cta'; cta.innerHTML = '<span class="tap-play">Open Gallery</span>';

      meta.appendChild(label); meta.appendChild(sub); meta.appendChild(cta);
      a.appendChild(img); a.appendChild(meta);
      hub.appendChild(a);
    });
  }

  // GALLERY PAGE
  async function renderGallery(){
    const grid = document.getElementById('photoGrid');
    if(!grid) return;
    const noPhotos = document.getElementById('noPhotos');
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year');
    const title = document.getElementById('galleryTitle');
    const sub = document.getElementById('gallerySub');
    if(!year){ title.textContent='Gallery'; sub.textContent='Year not specified.'; grid.style.display='none'; return; }
    title.textContent = year;
    sub.textContent = `Photos for ${year}`;

    const jsonUrl = `content/photos/${year}.json?v=${Date.now()}`;
    console.log('Photos year:', year, 'JSON:', jsonUrl);
    const json = await fetchJson(jsonUrl);
    if(!json){ grid.style.display='none'; noPhotos.style.display='block'; noPhotos.textContent = 'Unable to load photos.'; return; }

    // If the JSON uses galleries (preferred), render each gallery with its own section
    if(Array.isArray(json.galleries) && json.galleries.length){
      grid.innerHTML = '';
      grid.style.display = 'block';
      noPhotos.style.display = 'none';

      json.galleries.forEach(g => {
        const section = document.createElement('section'); section.className = 'gallery-section';
        const h = document.createElement('h2'); h.className = 'gallery-title'; h.textContent = g.title || g.section || '';
        section.appendChild(h);

        if(!Array.isArray(g.images) || g.images.length === 0){
          const p = document.createElement('div'); p.className='panel'; p.textContent = 'No photos yet.'; section.appendChild(p);
        } else {
          const innerGrid = document.createElement('div'); innerGrid.className = 'photo-grid';
          // prepare mapped photos for lightbox
          const mapped = g.images.map(img => ({ src: img.image || img.src || img.url || '', caption: img.caption || '', subtitle: img.subtitle || '' }));
          mapped.forEach((p, idx) => {
            const fig = document.createElement('figure'); fig.className='photo-thumb'; fig.tabIndex=0; fig.setAttribute('role','button');
            const imgEl = document.createElement('img'); imgEl.src = p.src; imgEl.alt = p.caption || p.subtitle || '';
            const cap = document.createElement('div'); cap.className='cap';
            const capTitle = document.createElement('div'); capTitle.className='cap-title'; capTitle.textContent = p.caption || '';
            const capSub = document.createElement('div'); capSub.className='cap-sub'; capSub.textContent = p.subtitle || '';
            cap.appendChild(capTitle); if(p.subtitle) cap.appendChild(capSub);
            fig.appendChild(imgEl); if(p.caption || p.subtitle) fig.appendChild(cap);
            fig.addEventListener('click', ()=> openLightbox(mapped, idx));
            fig.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); openLightbox(mapped, idx); } });
            innerGrid.appendChild(fig);
          });
          section.appendChild(innerGrid);
        }

        grid.appendChild(section);
      });

      return;
    }

    // Fallback: older JSON shapes (array or photos list) — flatten and render
    const photos = normalizePhotos(json);
    if(!photos || photos.length === 0){ grid.style.display='none'; noPhotos.style.display='block'; noPhotos.textContent = 'No photos yet.'; return; }

    grid.style.display='grid'; noPhotos.style.display='none';
    grid.innerHTML='';
    photos.forEach((p, idx) => {
      const fig = document.createElement('figure'); fig.className='photo-thumb'; fig.tabIndex=0; fig.setAttribute('role','button');
      const img = document.createElement('img'); img.src = p.src || p.image || ''; img.alt = p.alt || p.caption || '';
      const cap = document.createElement('div'); cap.className='cap'; cap.textContent = p.caption || '';
      fig.appendChild(img); if(p.caption) fig.appendChild(cap);
      fig.addEventListener('click', (e)=> openLightbox(photos, idx));
      fig.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); openLightbox(photos, idx); } });
      grid.appendChild(fig);
    });
  }

  // LIGHTBOX
  let lb = null;
  function ensureLightbox(){
    if(lb) return lb;
    lb = document.createElement('div'); lb.className='photos-lightbox'; lb.innerHTML = `
      <div class="panel">
        <div class="stage"><img src="" alt=""/></div>
        <div class="lb-controls">
          <div class="nav">
            <button class="lb-btn" data-action="prev">◀ Prev</button>
            <button class="lb-btn" data-action="next">Next ▶</button>
          </div>
          <div class="lb-meta"><div class="lb-caption"></div><div class="lb-subtitle"></div><div class="lb-index"></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(lb);

    lb.querySelector('[data-action="prev"]').addEventListener('click', ()=> lbNavigate(-1));
    lb.querySelector('[data-action="next"]').addEventListener('click', ()=> lbNavigate(1));
    lb.addEventListener('click', (e)=>{ if(e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', (e)=>{
      if(!lb.classList.contains('open')) return;
      if(e.key === 'Escape') closeLightbox();
      else if(e.key === 'ArrowLeft') lbNavigate(-1);
      else if(e.key === 'ArrowRight') lbNavigate(1);
    });

    // touch swipe support
    let touchStartX = null;
    lb.addEventListener('touchstart', (e)=>{ if(e.touches && e.touches.length) touchStartX = e.touches[0].clientX; });
    lb.addEventListener('touchend', (e)=>{ if(touchStartX === null) return; const endX = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX) || 0; const dx = endX - touchStartX; const thresh = 50; if(dx > thresh) lbNavigate(-1); else if(dx < -thresh) lbNavigate(1); touchStartX = null; });
    return lb;
  }

  let currentPhotos = [];
  let currentIndex = 0;
  function openLightbox(photos, idx){
    currentPhotos = photos; currentIndex = idx || 0;
    const box = ensureLightbox();
    updateLightbox();
    box.classList.add('open');
    box.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){ if(!lb) return; lb.classList.remove('open'); lb.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  function lbNavigate(delta){ if(!currentPhotos.length) return; currentIndex = (currentIndex + delta + currentPhotos.length) % currentPhotos.length; updateLightbox(); }
  function updateLightbox(){ if(!lb) return; const img = lb.querySelector('img'); const caption = lb.querySelector('.lb-caption'); const subtitle = lb.querySelector('.lb-subtitle'); const indexEl = lb.querySelector('.lb-index'); const p = currentPhotos[currentIndex] || {}; img.src = p.src || p.image || ''; img.alt = p.alt || p.caption || ''; caption.textContent = p.caption || p.alt || ''; subtitle.textContent = p.subtitle || ''; indexEl.textContent = `${currentIndex+1} / ${currentPhotos.length}`; }

  // Init on DOM
  document.addEventListener('DOMContentLoaded', ()=>{
    renderYearHub();
    renderGallery();
  });

})();
