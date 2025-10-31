---
layout: page
title: Daly arXiv News
icon: far fa-lightbulb
permalink: /arxiv/
order: 2
---


<style>
  /* ===== Fancy+ Pro with History, filters, and subtle download ===== */
  .ax-wrap{display:flex;flex-direction:column;gap:14px}
  .ax-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .ax-input{flex:1;min-width:230px;padding:.55rem .75rem;border:1px solid var(--card-border-color,#e5e7eb);border-radius:12px}
  .ax-btn,.ax-select{padding:.5rem .7rem;border:1px solid var(--card-border-color,#e5e7eb);border-radius:10px;background:var(--bg,transparent);cursor:pointer;text-decoration:none;display:inline-block}
  .ax-select{min-width:160px}
  .ax-chip{padding:.35rem .6rem;border:1px solid var(--card-border-color,#e5e7eb);border-radius:999px;cursor:pointer;font-size:.9rem;opacity:.85}
  .ax-chip.active{background:#00000010;border-color:#00000030;opacity:1}
  .ax-count{opacity:.75;font-size:.9rem;margin-left:auto}
  .ax-grid{display:grid;gap:14px}
  .ax-card{padding:.6rem .9rem;border:1px solid var(--card-border-color,#e5e7eb);border-radius:14px}
  .ax-title{margin:.1rem 0 .35rem 0;line-height:1.2}
  .ax-meta{font-size:.92rem;opacity:.85;margin-bottom:.4rem;display:flex;flex-wrap:wrap;gap:6px}
  .ax-badge{font-size:.72rem;padding:.15rem .4rem;border-radius:6px;background:#0000000d;border:1px solid #0000001a}
  .ax-abs{margin:.35rem 0 0 0;white-space:pre-wrap}
  .ax-links{margin-top:.5rem;font-size:.95rem;display:flex;gap:10px;flex-wrap:wrap}
  .ax-actions{margin-left:auto;display:flex;gap:6px}
  .ax-ghost{border-color:#0000;background:#0000}
  .ax-skel{height:110px;border-radius:14px;background:linear-gradient(90deg,#00000008,#00000014,#00000008);background-size:200% 100%;animation:sh 1.1s linear infinite}
  @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
  .ax-empty{opacity:.7}
  .ax-hl{background:linear-gradient(transparent 60%, #ffe08a88 0)}
  .ax-row{display:flex;gap:10px;align-items:center}
  .ax-view-toggle .ax-btn{padding:.35rem .55rem}
  .ax-list .ax-card{display:flex;gap:12px;align-items:flex-start}
  .ax-leftbar{display:flex;flex-direction:column;gap:6px;align-items:center}
  .ax-star{cursor:pointer}
  .ax-toast{position:fixed;right:16px;bottom:16px;padding:.6rem .8rem;background:#111;color:#fff;border-radius:10px;opacity:.95;z-index:9999}

  /* bottom download — subtle */
  .ax-footer{display:flex;justify-content:center;margin-top:10px}
  .ax-download{font-size:.85rem;opacity:.7;border:1px dashed var(--card-border-color,#e5e7eb);padding:.4rem .7rem;border-radius:10px;text-decoration:none}
  .ax-download:hover{opacity:.9}
</style>

<div class="ax-wrap" id="arxiv-app">
  <div class="ax-toolbar">
    <!-- History (Today + YYYY-MM-DD from backend) -->
    <select id="ax-date" class="ax-select">
      <option value="">Today</option>
    </select>

    <!-- Free-text (maps to ?q=) -->
    <input id="ax-q" class="ax-input" placeholder="Search title / abstract / author… (q=, e.g., diffusion, speech, LLM)">

    <!-- Keywords OR list (maps to ?kw=) -->
    <input id="ax-kw" class="ax-input" style="min-width:200px" placeholder="Keywords (kw=, comma-separated: audio,LLM)">

    <select id="ax-sort" class="ax-select">
      <option value="date_desc">Sort: Date ↓</option>
      <option value="date_asc">Sort: Date ↑</option>
      <option value="title_asc">Sort: Title A→Z</option>
      <option value="cat_asc">Sort: Category</option>
    </select>

    <div class="ax-view-toggle">
      <button id="ax-view-card" class="ax-btn">Cards</button>
      <button id="ax-view-list" class="ax-btn ax-ghost">List</button>
    </div>
    <button id="ax-fav-only" class="ax-btn ax-ghost">⭐ Favorites: Off</button>
    <span id="ax-count" class="ax-count"></span>
  </div>

  <!-- Category chips -->
  <div id="ax-chips" class="ax-row"></div>

  <div id="ax-grid" class="ax-grid"></div>
  <button id="ax-more" class="ax-btn" style="display:none;margin:0 auto;">Load more</button>

  <!-- Subtle bottom download -->
  <div class="ax-footer">
    <a id="ax-download" class="ax-download" href="#" rel="noopener" download>Download all history (ZIP)</a>
  </div>
</div>

<script>
(function(){
  const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';
  const CATS = ['cs.CL','cs.LG','cs.AI','cs.SD','eess.AS','cs.CV','cs.MM','cs.IR','cs.NE','stat.ML'];

  // state
  let ALL=[], query='', kw='', cat=null, sort='date_desc', view='card', favOnly=false, day='';
  let page=0, pageSize=12;
  const $ = s=>document.querySelector(s);
  const grid=$('#ax-grid'), q=$('#ax-q'), kwInp=$('#ax-kw'), chips=$('#ax-chips'), count=$('#ax-count');
  const sortSel=$('#ax-sort'), btnCard=$('#ax-view-card'), btnList=$('#ax-view-list'), moreBtn=$('#ax-more'), favBtn=$('#ax-fav-only'), dateSel=$('#ax-date'), dl=$('#ax-download');

  // local favorites
  const FKEY='arxiv:favs';
  const favSet=new Set(JSON.parse(localStorage.getItem(FKEY)||'[]'));
  const saveFavs=()=>localStorage.setItem(FKEY, JSON.stringify([...favSet]));
  const isFav=id=>favSet.has(id);
  const toggleFav=id=>{ isFav(id)?favSet.delete(id):favSet.add(id); saveFavs(); render(true); refreshDownloadLink(); };

  function toast(msg, ms=2200){ const t=document.createElement('div'); t.className='ax-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), ms); }
  function escapeHTML(s){return (s||'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function hl(text,q){ if(!q) return escapeHTML(text||''); const esc=escapeHTML(text||''); const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); return esc.replace(re,'<span class="ax-hl">$1</span>'); }

  function bibtex(p){
    const id=(p.id||'').replace(/v\d+$/,'')||'arxiv';
    const authors=(Array.isArray(p.authors)?p.authors.join(' and '):(p.authors||'')).replace(/&/g,'and');
    const year=(p.date||'').slice(0,4) || new Date().getUTCFullYear();
    const title=p.title||''; const pc=(p.primary||'cs');
    return `@misc{${id},
  title={${title}},
  author={${authors}},
  year={${year}},
  eprint={${id}},
  archivePrefix={arXiv},
  primaryClass={${pc}}
}`;
  }
  const copy=text=>navigator.clipboard.writeText(text).then(()=>toast('Copied!'));

  // ------------ server interaction ------------
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
    // Build ZIP download link reflecting current day/q/kw/cat
    let url = `${API_BASE}/history.zip`;
    const params = new URLSearchParams();
    if (day) { params.set('start', day); params.set('end', day); }
    if (query.trim()) params.set('q', query.trim());
    if (kw.trim())    params.set('kw', kw.trim());
    if (cat)          params.set('cat', cat);
    params.set('filter','1'); // zip with filtered contents
    const qs = params.toString();
    dl.href = qs ? `${url}?${qs}` : url;
  }

  async function loadServer() {
    skeleton();
    try{
      const url = buildDataURL();
      const res = await fetch(url, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      ALL = await res.json();
      render(true);
    }catch(e){
      console.error(e);
      grid.innerHTML = `<div class="ax-card ax-empty">Failed to load arXiv feed.</div>`;
    } finally {
      refreshDownloadLink();
    }
  }

  async function loadHistoryList(){
    try{
      const res = await fetch(`${API_BASE}/history`, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const files = await res.json();
      files.forEach(fn=>{
        const d = fn.replace(/\.json$/,'');
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        dateSel.appendChild(opt);
      });
    }catch(e){
      console.warn('history list unavailable (ok if first day)', e);
    }
  }

  // ------------ UI helpers ------------
  function chip(label){
    const b=document.createElement('button'); b.className='ax-chip'+(cat===label?' active':''); b.textContent=label;
    b.onclick=()=>{ cat=(cat===label?null:label); resetAndLoad(); };
    return b;
  }
  function renderChips(){ chips.innerHTML=''; CATS.forEach(c=>chips.appendChild(chip(c))); if(cat){ const x=chip('× clear'); x.onclick=()=>{cat=null; resetAndLoad();}; chips.appendChild(x);} }

  function filteredClient(){
    // server already applied q/kw/cat; keep local sort + favorites/pin
    let arr=ALL.slice();
    arr.sort((a,b)=>{
      const ad=a.date||'', bd=b.date||'', at=(a.title||'').toLowerCase(), bt=(b.title||'').toLowerCase();
      const ac=(a.primary||''), bc=(b.primary||'');
      if(sort==='date_desc') return bd.localeCompare(ad) || at.localeCompare(bt);
      if(sort==='date_asc')  return ad.localeCompare(bd) || at.localeCompare(bt);
      if(sort==='title_asc') return at.localeCompare(bt);
      if(sort==='cat_asc')   return ac.localeCompare(bc) || bd.localeCompare(ad);
      return 0;
    });
    if(favOnly) arr=arr.filter(p=>isFav((p.id||'').replace(/v\d+$/,'')));
    if(!favOnly){
      const F=[], N=[]; arr.forEach(p=>isFav((p.id||'').replace(/v\d+$/,''))?F.push(p):N.push(p)); arr=[...F,...N];
    }
    return arr;
  }

  function iconStar(active){return active?'⭐':'☆';}

  function cardHTML(p){
    const baseId=(p.id||'').replace(/v\d+$/,'');
    const title=p.title||''; const authors=Array.isArray(p.authors)?p.authors.join(', '):(p.authors||'');
    const abs=p.abs || (baseId?`https://arxiv.org/abs/${baseId}`:'#'); const pdf=p.pdf || (baseId?`https://arxiv.org/pdf/${baseId}.pdf`:'#');
    const primary=p.primary||'arXiv', date=p.date||''; const abstract=p.abstract||p.summary||'';
    const fav=isFav(baseId);

    return view==='card' ? `
      <article class="ax-card">
        <div class="ax-row">
          <h3 class="ax-title" style="flex:1 1 auto;">${hl(title,query)}</h3>
          <div class="ax-actions">
            <a href="${abs}" target="_blank" rel="noopener" class="ax-btn">abs</a>
            <a href="${pdf}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
            <button class="ax-btn" data-bib="${baseId}" title="Copy BibTeX">BibTeX</button>
            <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}" title="Toggle favorite">${iconStar(fav)}</button>
          </div>
        </div>
        <div class="ax-meta">
          <span class="ax-badge">${primary}</span>
          ${date?`<span class="ax-badge">${date}</span>`:''}
          ${baseId?`<span class="ax-badge">arXiv:${baseId}</span>`:''}
        </div>
        <div class="ax-meta">${hl(authors,query)}</div>
        <details>
          <summary style="cursor:pointer;opacity:.88">Abstract</summary>
          <p class="ax-abs">${hl(abstract,query)}</p>
        </details>
      </article>
    ` : `
      <article class="ax-card">
        <div class="ax-leftbar">
          <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}" title="Toggle favorite">${iconStar(fav)}</button>
          ${date?`<div class="ax-badge">${date}</div>`:''}
          <div class="ax-badge">${primary}</div>
        </div>
        <div style="flex:1">
          <h3 class="ax-title">${hl(title,query)}</h3>
          <div class="ax-meta">${baseId?`<span class="ax-badge">arXiv:${baseId}</span>`:''}</div>
          <div class="ax-meta">${hl(authors,query)}</div>
          <details>
            <summary style="cursor:pointer;opacity:.88">Abstract</summary>
            <p class="ax-abs">${hl(abstract,query)}</p>
          </details>
          <div class="ax-links">
            <a href="${abs}" target="_blank" rel="noopener" class="ax-btn">abs</a>
            <a href="${pdf}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
            <button class="ax-btn" data-bib="${baseId}" title="Copy BibTeX">Copy BibTeX</button>
          </div>
        </div>
      </article>
    `;
  }

  function attachActions(scope){
    scope.querySelectorAll('[data-bib]').forEach(b=>{
      b.onclick=()=>{
        const id=b.getAttribute('data-bib');
        const p=ALL.find(x=>(x.id||'').replace(/v\d+$/,'')===id);
        if(p) copy(bibtex(p));
      };
    });
    scope.querySelectorAll('[data-fav]').forEach(b=>{
      b.onclick=()=>{ toggleFav(b.getAttribute('data-fav')); };
    });
  }

  function skeleton(n=6){ grid.innerHTML=Array.from({length:n}).map(()=>`<div class="ax-skel"></div>`).join(''); }

  function render(resetLayout=false){
    renderChips();
    const items=filteredClient();
    if(resetLayout) grid.classList.toggle('ax-list', view==='list');
    const total=items.length;
    const start=page*pageSize, end=Math.min(start+pageSize,total);
    if(start===0) grid.innerHTML='';
    const chunk=items.slice(start,end);
    const html=chunk.map(cardHTML).join('');
    const frag=document.createElement('div'); frag.innerHTML=html; attachActions(frag);
    grid.append(...frag.childNodes);
    count.textContent=`${total} item${total!==1?'s':''}${cat?` · ${cat}`:''}${query?` · “${query}”`:''}${kw?` · kw:${kw}`:''}${favOnly?' · ⭐':''}${day?` · ${day}`:' · Today'}`;
    moreBtn.style.display=end<total?'block':'none';
  }

  function reset(){ page=0; grid.innerHTML=''; render(true); refreshDownloadLink(); }
  function resetAndLoad(){ page=0; loadServer(); } // refreshDownloadLink() is called inside loadServer()

  // ------------ init ------------
  async function boot(){
    // controls
    q.value=''; kwInp.value=''; query=''; kw=''; cat=null; sort='date_desc'; view='card'; favOnly=false; day='';
    q.oninput=e=>{ query=e.target.value; resetAndLoad(); };
    kwInp.oninput=e=>{ kw=e.target.value; resetAndLoad(); };
    sortSel.onchange=e=>{ sort=e.target.value; reset(); };
    $('#ax-view-card').onclick=()=>{ view='card'; btnCard.classList.remove('ax-ghost'); btnList.classList.add('ax-ghost'); reset(); };
    $('#ax-view-list').onclick=()=>{ view='list'; btnList.classList.remove('ax-ghost'); btnCard.classList.add('ax-ghost'); reset(); };
    favBtn.onclick=()=>{ favOnly=!favOnly; favBtn.textContent=favOnly?'⭐ Favorites: On':'⭐ Favorites: Off'; reset(); };
    moreBtn.onclick=()=>{ page++; render(); refreshDownloadLink(); };
    dateSel.onchange=e=>{ day=e.target.value; resetAndLoad(); };

    chips.innerHTML=''; CATS.forEach(c=>chips.appendChild(chip(c)));

    await loadHistoryList();
    await loadServer();     // includes refreshDownloadLink()
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('pjax:complete', boot); // Chirpy PJAX
})();
</script>