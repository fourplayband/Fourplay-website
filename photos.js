// photos.js — shared logic for photos Year Hub and Year Gallery + Lightbox
(() => {
  const PRIORITY_ORDER = ["2026","2025","2024","2023","2022","2020-2021","2016-2019"];

  // utility: fetch JSON and return { json, status }
  async function fetchJsonWithStatus(path){
    try{
      const url = (path.startsWith('/') || path.startsWith('http')) ? path : '/' + path;
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
      const status = res.status;
      if(!res.ok){ console.error('fetch failed', url, status); return { json: null, status }; }
      const json = await res.json();
      return { json, status };
    }catch(e){ console.error('fetch error', path, e); return { json: null, status: 'network' }; }
  }

  function normalizePhotos(data){
    if(!data) return [];
    // format A: array
    if(Array.isArray(data)) return data.map(normalizePhoto);
    if(Array.isArray(data.photos)) return data.photos.map(normalizePhoto);
    // galleries -> flatten
    if(Array.isArray(data.galleries)){
      const imgs = [];
      data.galleries.forEach(g=>{ if(Array.isArray(g.images)) imgs.push(...g.images.map(normalizePhoto)); });
      return imgs;
    }
    return [];
  }
  function normalizePhoto(p){
    if(!p) return { src:'', alt:'', caption:'', subtitle: '' };
    if(typeof p === 'string') return { src:p, alt:'', caption:'', subtitle: '' };
    return {
      src: p.image || p.src || p.url || p.path || '',
      alt: p.alt || p.title || p.caption || '',
      caption: p.title || p.caption || p.subtitle || '',
      subtitle: p.subtitle || ''
    };
  }

  // YEAR HUB
  async function renderYearHub(){
    const hub = document.getElementById('yearHub');
    if(!hub) return;
    // Only render hub tiles from the CMS-managed index.json
    const { json: indexJson } = await fetchJsonWithStatus('/content/photos/index.json');
    const years = [];
    if(indexJson && Array.isArray(indexJson.years) && indexJson.years.length){
      indexJson.years.forEach(y=>{
        years.push({ id: String(y.slug || y.year || y.id || ''), label: String(y.label || y.year || y.id || ''), cover: String(y.cover || '') });
      });
    } else {
      // nothing to render — surface friendly message
      hub.innerHTML = '<div class="panel">No photo hubs configured. Please add content/photos/index.json in CMS.</div>';
      return;
    }

    const ordered = years; // keep CMS order

    // render cards
    hub.innerHTML = '';
    ordered.forEach(y=>{
      const a = document.createElement('a');
      a.className = 'year-card' + (y.id.includes('-')||y.id.includes('–')? ' archive':'');
      if(y.id === '2026') a.classList.add('featured');
      a.href = `/photos-year.html?year=${encodeURIComponent(y.id)}`;
      a.setAttribute('role','listitem');

      const img = document.createElement('img'); img.className='cover'; img.alt = y.label + ' cover'; img.loading='lazy';
      let coverUrl = (y.cover || y.thumbnail || '');
      if(coverUrl && !coverUrl.startsWith('/') && !coverUrl.startsWith('http')) coverUrl = '/' + coverUrl;
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
    const debugEl = document.getElementById('photoDebug');
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year');
    const title = document.getElementById('galleryTitle');
    const sub = document.getElementById('gallerySub');
    if(!year){ title.textContent='Gallery'; sub.textContent='Year not specified.'; grid.style.display='none'; return; }
    title.textContent = year;
    sub.textContent = `Photos for ${year}`;

    // Fetch hub index first (to get label/title from CMS)
    const { json: hubIndex } = await fetchJsonWithStatus('/content/photos/index.json');
    if(hubIndex && Array.isArray(hubIndex.years)){
      const found = hubIndex.years.find(y => String(y.slug || y.year || y.id) === String(year));
      if(found){ title.textContent = found.label || (found.year || year); sub.textContent = found.subtitle || `Photos for ${found.label || year}`; }
    }

    // Attempt candidate files in order with cache-busting
    const candidates = [
      `/content/photos/${year}.json`,
      `/content/photos/${year}/index.json`,
      `/content/photos/${year}/photos.json`,
      `content/photos/${year}.json`,
      `content/photos/${year}/index.json`,
      `content/photos/${year}/photos.json`
    ];

    if(debugEl) debugEl.textContent = 'Loading: trying candidates...';

    let resolved = null;
    const attempts = [];
    for(const p of candidates){
      const { json, status } = await fetchJsonWithStatus(p);
      attempts.push({ url: p, status });
      if(json){ resolved = { json, url: p, status }; break; }
    }

    if(resolved){
      if(debugEl) debugEl.textContent = `Loading: ${resolved.url}`;
    } else {
      grid.style.display='none'; noPhotos.style.display='block';
      const statuses = attempts.map(a=>`${a.url} (${a.status})`).join(', ');
      noPhotos.textContent = `Unable to load photos. Tried: ${statuses}`;
      if(debugEl) debugEl.textContent = `Failed: ${statuses}`;
      return;
    }

    const json = resolved.json;

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
          // prepare mapped photos for lightbox (use normalizePhoto to prefer title)
          const mapped = g.images.map(img => {
            const norm = normalizePhoto(img);
            let src = norm.src || '';
            if(src && !src.startsWith('/') && !src.startsWith('http')) src = '/' + src;
            return { src, caption: norm.caption || '', subtitle: norm.subtitle || '', alt: norm.alt || '' };
          });
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
