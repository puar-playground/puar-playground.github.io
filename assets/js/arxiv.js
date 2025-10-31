/* ==========================================================
   arxiv.js — standalone, PJAX-safe script for Chirpy/Jekyll
   ========================================================== */

(function () {
  const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';
  const CATS = ['cs.CL','cs.LG','cs.AI','cs.SD','eess.AS','cs.CV','cs.MM','cs.IR','cs.NE','stat.ML'];

  // state
  let ALL = [], query = '', kw = '', cat = null, sort = 'date_desc', view = 'card', favOnly = false, day = '';
  let page = 0, pageSize = 12;

  const $ = s => document.querySelector(s);
  const grid = () => $('#ax-grid');
  const count = () => $('#ax-count');
  const chips = () => $('#ax-chips');
  const dateSel = () => $('#ax-date');
  const dl = () => $('#ax-download');

  /* ---------- favorites ---------- */
  const FKEY = 'arxiv:favs';
  const favSet = new Set(JSON.parse(localStorage.getItem(FKEY) || '[]'));
  const saveFavs = () => localStorage.setItem(FKEY, JSON.stringify([...favSet]));
  const isFav = id => favSet.has(id);

  const toggleFav = id => {
    isFav(id) ? favSet.delete(id) : favSet.add(id);
    saveFavs();
    render(true);
    refreshDownloadLink();
  };

  /* ---------- helpers ---------- */
  function toast(msg, ms=1800) {
    const t = document.createElement('div');
    t.className = 'ax-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]); }

  function hl(text, q) {
    if (!q) return escapeHTML(text||'');
    const esc = escapeHTML(text || '');
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'ig');
    return esc.replace(re, '<span class="ax-hl">$1</span>');
  }

  function bibtex(p){
    const id = (p.id || '').replace(/v\d+$/, '');
    const authors = (Array.isArray(p.authors) ? p.authors.join(' and ') : p.authors||'').replace(/&/g,'and');
    const year = (p.date||'').slice(0,4) || new Date().getUTCFullYear();
    const title = p.title || ''; const pc = p.primary || 'cs';
    return `@misc{${id},
  title={${title}},
  author={${authors}},
  year={${year}},
  eprint={${id}},
  archivePrefix={arXiv},
  primaryClass={${pc}}
}`;
  }

  const copy = text => navigator.clipboard.writeText(text).then(() => toast('Copied!'));

  /* ---------- server interaction ---------- */
  function buildDataURL() {
    const base = day ? `${API_BASE}/history/${day}.json` : `${API_BASE}/latest.json`;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (kw.trim())    params.set('kw', kw.trim());
    if (cat)          params.set('cat', cat);
    params.set('limit', String((page+1)*pageSize));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function refreshDownloadLink() {
    let url = `${API_BASE}/history.zip`;
    const params = new URLSearchParams();
    if (day) params.set('start', day), params.set('end', day);
    if (query.trim()) params.set('q', query.trim());
    if (kw.trim()) params.set('kw', kw.trim());
    if (cat) params.set('cat', cat);
    params.set('filter','1');
    dl().href = params.toString() ? `${url}?${params}` : url;
  }

  async function loadServer() {
    skeleton();
    try {
      const res = await fetch(buildDataURL(), { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      ALL = await res.json();
      render(true);
    } catch (e){
      grid().innerHTML = `<div class="ax-card ax-empty">Failed to load arXiv feed.</div>`;
    } finally {
      refreshDownloadLink();
    }
  }

  async function loadHistoryList() {
    try {
      const res = await fetch(`${API_BASE}/history`, { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const files = await res.json();
      files.forEach(fn => {
        const d = fn.replace(/\.json$/,'');
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        dateSel().appendChild(opt);
      });
    } catch {}
  }

  /* ---------- UI / rendering ---------- */
  function iconStar(active){ return active ? '⭐' : '☆'; }

  function cardHTML(p) {
    const baseId = (p.id || '').replace(/v\d+$/, '');
    const title = p.title || '';
    const authors = Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || '');
    const abs = p.abs || `https://arxiv.org/abs/${baseId}`;
    const pdf = p.pdf || `https://arxiv.org/pdf/${baseId}.pdf`;
    const primary = p.primary || 'arXiv';
    const date = p.date || '';
    const abstract = p.abstract || '';
    const fav = isFav(baseId);

    return view === 'card' ? `
      <article class="ax-card">
        <div class="ax-row">
          <h3 class="ax-title" style="flex:1 1 auto;">${hl(title,query)}</h3>
          <div class="ax-actions">
            <a href="${abs}" target="_blank" rel="noopener" class="ax-btn">abs</a>
            <a href="${pdf}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
            <button class="ax-btn" data-bib="${baseId}">BibTeX</button>
            <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}">${iconStar(fav)}</button>
          </div>
        </div>
        <div class="ax-meta">
          <span class="ax-badge">${primary}</span>
          ${date?`<span class="ax-badge">${date}</span>`:''}
          <span class="ax-badge">arXiv:${baseId}</span>
        </div>
        <div class="ax-meta">${hl(authors,query)}</div>
        <details><summary style="cursor:pointer">Abstract</summary><p class="ax-abs">${hl(abstract,query)}</p></details>
      </article>
    ` : `
      <article class="ax-card ax-row">
        <div class="ax-leftbar">
          <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}">${iconStar(fav)}</button>
          ${date?`<div class="ax-badge">${date}</div>`:''}
          <div class="ax-badge">${primary}</div>
        </div>
        <div style="flex:1">
          <h3 class="ax-title">${hl(title,query)}</h3>
          <div class="ax-meta"><span class="ax-badge">arXiv:${baseId}</span></div>
          <div class="ax-meta">${hl(authors,query)}</div>
          <details><summary style="cursor:pointer">Abstract</summary><p class="ax-abs">${hl(abstract,query)}</p></details>
          <div class="ax-links">
            <a href="${abs}" target="_blank" rel="noopener" class="ax-btn">abs</a>
            <a href="${pdf}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
            <button class="ax-btn" data-bib="${baseId}">Copy BibTeX</button>
          </div>
        </div>
      </article>
    `;
  }

  function attachActions(scope){
    scope.querySelectorAll('[data-bib]').forEach(b=>{
      b.onclick = () => {
        const id = b.getAttribute('data-bib');
        const p = ALL.find(x => (x.id || '').replace(/v\d+$/, '') === id);
        if (p) copy(bibtex(p));
      };
    });

    scope.querySelectorAll('[data-fav]').forEach(b=>{
      b.onclick = () => toggleFav(b.getAttribute('data-fav'));
    });
  }

  function filteredClient() {
    let arr = ALL.slice();
    arr.sort((a,b)=>{
      const ad = a.date||'', bd=b.date||'';
      const at=(a.title||'').toLowerCase(), bt=(b.title||'').toLowerCase();
      const ac = a.primary || '', bc = b.primary || '';
      if (sort==='date_desc') return bd.localeCompare(ad) || at.localeCompare(bt);
      if (sort==='date_asc')  return ad.localeCompare(bd) || at.localeCompare(bt);
      if (sort==='title_asc') return at.localeCompare(bt);
      if (sort==='cat_asc')   return ac.localeCompare(bc) || bd.localeCompare(ad);
      return 0;
    });
    if (favOnly) arr = arr.filter(p=>isFav((p.id||'').replace(/v\d+$/,'')));
    if (!favOnly) {
      const F=[], N=[];
      arr.forEach(p=>isFav((p.id||'').replace(/v\d+$/,''))?F.push(p):N.push(p));
      arr = [...F, ...N];
    }
    return arr;
  }

  function skeleton(n = 6) {
    grid().innerHTML = Array.from({length:n}).map(()=>`<div class="ax-skel"></div>`).join('');
  }

  function render(resetLayout=false){
    renderChips();
    const items = filteredClient();
    if (resetLayout) grid().classList.toggle('ax-list', view==='list');
    const total = items.length;
    const start = page*pageSize, end = Math.min(start+pageSize,total);
    if (start===0) grid().innerHTML = '';
    const chunk = items.slice(start,end);
    const frag = document.createElement('div');
    frag.innerHTML = chunk.map(cardHTML).join('');
    attachActions(frag);
    grid().append(...frag.childNodes);
    count().textContent = `${total} item${total!==1?'s':''}${cat?` · ${cat}`:''}${query?` · “${query}”`:''}${kw?` · kw:${kw}`:''}${favOnly?' · ⭐':''}${day?` · ${day}`:' · Today'}`;
    $('#ax-more').style.display = end < total ? 'block' : 'none';
  }

  function renderChips() {
    chips().innerHTML = '';
    CATS.forEach(c=>{
      const b = document.createElement('button');
      b.className = 'ax-chip' + (cat===c?' active':'');
      b.textContent = c;
      b.onclick = () => { cat = (cat===c ? null : c); resetAndLoad(); };
      chips().appendChild(b);
    });
    if (cat) {
      const b=document.createElement('button');
      b.className='ax-chip';
      b.textContent='clear';
      b.onclick=()=>{ cat=null; resetAndLoad(); };
      chips().appendChild(b);
    }
  }

  function reset(){ page=0; grid().innerHTML=''; render(true); refreshDownloadLink(); }
  function resetAndLoad(){ page=0; loadServer(); }

  /* ---------- boot ---------- */
  async function boot(){
    if (!$('#arxiv-app')) return;   // <-- PJAX: only run on this page

    // bind controls (once)
    $('#ax-q').oninput = e => { query = e.target.value; resetAndLoad(); };
    $('#ax-kw').oninput = e => { kw = e.target.value; resetAndLoad(); };
    $('#ax-sort').onchange = e => { sort=e.target.value; reset(); };
    $('#ax-view-card').onclick = () => { view='card'; $('#ax-view-card').classList.remove('ax-ghost'); $('#ax-view-list').classList.add('ax-ghost'); reset(); };
    $('#ax-view-list').onclick = () => { view='list'; $('#ax-view-list').classList.remove('ax-ghost'); $('#ax-view-card').classList.add('ax-ghost'); reset(); };
    $('#ax-fav-only').onclick = () => { favOnly=!favOnly; $('#ax-fav-only').textContent = favOnly?'⭐ Favorites: On':'⭐ Favorites: Off'; reset(); };
    $('#ax-more').onclick = () => { page++; render(); refreshDownloadLink(); };
    dateSel().onchange = e => { day = e.target.value; resetAndLoad(); };

    // fresh UI
    await loadHistoryList();
    await loadServer(); // includes refreshDownloadLink()
  }

  /* ---------- events ---------- */
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('pjax:complete', boot);

})();
