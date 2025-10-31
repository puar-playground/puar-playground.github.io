// assets/js/arxiv-app.js
(function () {
  // —— 防重入（PJAX 导航来回切换时很常见）
  if (window.__ARXIV_APP_INIT) {
    console.debug('[arxiv] already initialized, skip.');
    return;
  }
  window.__ARXIV_APP_INIT = true;
  window.__ARXIV_DEBUG = { marks: [] };
  const mark = (msg) => { console.debug('[arxiv]', msg); window.__ARXIV_DEBUG.marks.push(msg); };

  const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';
  const CATS = ['cs.CL','cs.LG','cs.AI','cs.SD','eess.AS','cs.CV','cs.MM','cs.IR','cs.NE','stat.ML'];

  // 从 <meta name="baseurl"> 读 base（User Page 下为空字符串）
  const BASE = document.querySelector('meta[name="baseurl"]')?.content || '';

  // ———— State / DOM ————
  let ALL=[], query='', kw='', cat=null, sort='date_desc', view='card', favOnly=false, day='';
  let page=0, pageSize=12;
  const $ = s=>document.querySelector(s);
  const grid=$('#ax-grid'), q=$('#ax-q'), kwInp=$('#ax-kw'), chips=$('#ax-chips'), count=$('#ax-count');
  const sortSel=$('#ax-sort'), btnCard=$('#ax-view-card'), btnList=$('#ax-view-list'),
        moreBtn=$('#ax-more'), favBtn=$('#ax-fav-only'), dateSel=$('#ax-date'), dl=$('#ax-download');

  // ———— 小工具 ————
  const FKEY='arxiv:favs';
  const favSet=new Set(JSON.parse(localStorage.getItem(FKEY)||'[]'));
  const saveFavs=()=>localStorage.setItem(FKEY, JSON.stringify([...favSet]));
  const isFav=id=>favSet.has(id);
  const toggleFav=id=>{ isFav(id)?favSet.delete(id):favSet.add(id); saveFavs(); render(true); refreshDownloadLink(); };
  const escapeHTML=s=>String(s||'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const hl=(text,q)=>{ const t=String(text||''); if(!q) return escapeHTML(t);
    const esc=escapeHTML(t), qs=String(q||''); if(!qs.trim()) return esc;
    try { const re=new RegExp('('+qs.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); return esc.replace(re,'<span class="ax-hl">$1</span>'); }
    catch { return esc; } };
  const bibtex=p=>{
    const id=(p.id||'').replace(/v\d+$/,'')||'arxiv';
    const authors=(Array.isArray(p.authors)?p.authors.join(' and '):(p.authors||'')).replace(/&/g,'and');
    const year=(p.date||'').slice(0,4)||new Date().getUTCFullYear();
    return `@misc{${id}, title={${p.title||''}}, author={${authors}}, year={${year}}, eprint={${id}}, archivePrefix={arXiv}, primaryClass={${p.primary||'cs'}} }`;
  };
  const copy = text => navigator.clipboard.writeText(text).catch(()=>{});

  // ———— 数据获取（本地 JSON 优先，其次 API，最后 CORS 代理）———
  async function fetchWithFallback(url) {
    const hasFilters = (query.trim() || kw.trim() || cat || day);
    if (!hasFilters) {
      try {
        const localUrl = `${BASE}/assets/js/data/arxiv-latest.json`;
        const res = await fetch(localUrl, {cache:'no-store'});
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) return data;
        }
      } catch {}
    }
    try {
      const res = await fetch(url, {cache:'no-store', mode:'cors'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    } catch (err) {
      if (String(err.message).includes('CORS') || String(err.message).includes('Failed to fetch')) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, {cache:'no-store', mode:'cors'});
        if (res.ok) {
          const pd = await res.json();
          return typeof pd.contents === 'string' ? JSON.parse(pd.contents) : pd.contents;
        }
      }
      throw err;
    }
  }

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
    if (day) { params.set('start', day); params.set('end', day); }
    if (query.trim()) params.set('q', query.trim());
    if (kw.trim())    params.set('kw', kw.trim());
    if (cat)          params.set('cat', cat);
    params.set('filter','1');
    const qs = params.toString();
    dl && (dl.href = qs ? `${url}?${qs}` : url);
  }

  async function loadServer() {
    skeleton();
    try {
      const url = buildDataURL();
      ALL = await fetchWithFallback(url);
      if (!Array.isArray(ALL)) throw new Error('Response is not an array');
      render(true);
    } catch (e) {
      grid.innerHTML = `<div class="ax-card ax-empty" style="padding:2rem;text-align:center;">
        <p><strong>Failed to load arXiv feed.</strong></p>
        <p style="font-size:.85rem;opacity:.7;margin-top:.5rem;">Error: ${escapeHTML(e.message)}</p></div>`;
    } finally { refreshDownloadLink(); }
  }

  async function loadHistoryList() {
    try {
      const localRes = await fetch(`${BASE}/assets/js/data/arxiv-history.json`, {cache:'no-store'});
      if (localRes.ok) {
        const files = await localRes.json();
        if (Array.isArray(files)) {
          files.forEach(fn => {
            const d = String(fn).replace(/\.json$/,'');
            const opt = document.createElement('option');
            opt.value = d; opt.textContent = d;
            dateSel && dateSel.appendChild(opt);
          });
          return;
        }
      }
    } catch {}
    try {
      const res = await fetch(`${API_BASE}/history`, {cache:'no-store', mode:'cors'});
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          files.forEach(fn => {
            const d = String(fn).replace(/\.json$/,'');
            const opt = document.createElement('option');
            opt.value = d; opt.textContent = d;
            dateSel && dateSel.appendChild(opt);
          });
        }
      }
    } catch {}
  }

  // ———— 渲染 ————
  function chip(label){
    const b=document.createElement('button');
    b.className='ax-chip'+(cat===label?' active':''); b.textContent=label;
    b.onclick=()=>{ cat=(cat===label?null:label); resetAndLoad(); };
    return b;
  }
  function renderChips(){
    const chipsEl = document.getElementById('ax-chips');
    if(!chipsEl) return;
    chipsEl.innerHTML='';
    CATS.forEach(c => chipsEl.appendChild(chip(c)));
    if(cat){
      const x=chip('× clear'); x.onclick=()=>{cat=null; resetAndLoad();}; chipsEl.appendChild(x);
    }
  }
  function filteredClient(){
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
    if(favOnly) arr=arr.filter(p=>isFav(String(p.id||'').replace(/v\d+$/,'')));
    if(!favOnly){
      const F=[], N=[];
      arr.forEach(p=>isFav(String(p.id||'').replace(/v\d+$/,''))?F.push(p):N.push(p));
      arr=[...F,...N];
    }
    return arr;
  }
  function iconStar(active){return active?'⭐':'☆';}
  function cardHTML(p){
    const baseId=String(p.id||'').replace(/v\d+$/,'');
    const title=p.title||'';
    const authors=Array.isArray(p.authors)?p.authors.join(', '):(p.authors||'');
    const abs=baseId?`https://arxiv.org/abs/${baseId}`:'#';
    const pdf=baseId?`https://arxiv.org/pdf/${baseId}.pdf`:'#';
    const primary=p.primary||'arXiv', date=p.date||'';
    const abstract=p.abstract||p.summary||'';
    const fav=isFav(baseId);
    return view==='card'
      ? `<article class="ax-card"><div class="ax-row">
            <h3 class="ax-title" style="flex:1 1 auto;">${hl(title,query)}</h3>
            <div class="ax-actions">
              <a href="${abs}" target="_blank" rel="noopener" class="ax-btn">abs</a>
              <a href="${pdf}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
              <button class="ax-btn" data-bib="${baseId}">BibTeX</button>
              <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}">${iconStar(fav)}</button>
            </div></div>
          <div class="ax-meta"><span class="ax-badge">${primary}</span>${date?`<span class="ax-badge">${date}</span>`:''}
          ${baseId?`<span class="ax-badge">arXiv:${baseId}</span>`:''}</div>
          <div class="ax-meta">${hl(authors,query)}</div>
          <details><summary style="cursor:pointer;opacity:.88">Abstract</summary>
            <p class="ax-abs">${hl(abstract,query)}</p>
          </details></article>`
      : `<article class="ax-card"><div class="ax-leftbar">
            <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}">${iconStar(fav)}</button>
            ${date?`<div class="ax-badge">${date}</div>`:''}<div class="ax-badge">${primary}</div>
          </div>
          <div style="flex:1">
            <h3 class="ax-title">${hl(title,query)}</h3>
            <div class="ax-meta">${baseId?`<span class="ax-badge">arXiv:${baseId}</span>`:''}</div>
            <div class="ax-meta">${hl(authors,query)}</div>
            <details><summary style="cursor:pointer;opacity:.88">Abstract</summary>
              <p class="ax-abs">${hl(abstract,query)}</p>
            </details>
            <div class="ax-links">
              <a class="ax-btn" target="_blank" rel="noopener" href="${abs}">abs</a>
              <a class="ax-btn" target="_blank" rel="noopener" href="${pdf}">pdf</a>
              <button class="ax-btn" data-bib="${baseId}">Copy BibTeX</button>
            </div>
          </div></article>`;
  }
  function attachActions(scope){
    scope.querySelectorAll('[data-bib]').forEach(b=>{
      b.onclick=()=>{ const id=b.getAttribute('data-bib'); const p=ALL.find(x=>String(x.id||'').replace(/v\d+$/,'')===id); if(p) copy(bibtex(p)); };
    });
    scope.querySelectorAll('[data-fav]').forEach(b=>{
      b.onclick=()=>{ toggleFav(b.getAttribute('data-fav')); };
    });
  }
  function skeleton(n=6){ grid && (grid.innerHTML=Array.from({length:n}).map(()=>`<div class="ax-skel"></div>`).join('')); }
  function render(resetLayout=false){
    renderChips();
    if(!grid || !count || !moreBtn) return;
    const items=filteredClient();
    if(resetLayout) grid.classList.toggle('ax-list', view==='list');
    const total=items.length, start=page*pageSize, end=Math.min(start+pageSize,total);
    if(start===0) grid.innerHTML='';
    const chunk=items.slice(start,end);
    if(chunk.length===0 && total===0 && start===0){
      grid.innerHTML = `<div class="ax-card ax-empty" style="padding:2rem;text-align:center;">No papers found.</div>`;
    } else {
      const frag=document.createElement('div'); frag.innerHTML=chunk.map(cardHTML).join('');
      attachActions(frag); grid.append(...frag.childNodes);
    }
    count.textContent = `${total} item${total!==1?'s':''}${cat?` · ${cat}`:''}${query?` · "${query}"`:''}${kw?` · kw:${kw}`:''}${favOnly?' · ⭐':''}${day?` · ${day}`:' · Today'}`;
    moreBtn.style.display = (end<total?'block':'none');
  }
  function reset(){ page=0; grid.innerHTML=''; render(true); refreshDownloadLink(); }
  function resetAndLoad(){ page=0; loadServer(); }

  // ———— 初始化 ————
  async function boot(){
    if(!chips || !grid || !q || !kwInp) return;
    q.value=''; kwInp.value='';
    query=''; kw=''; cat=null; sort='date_desc'; view='card'; favOnly=false; day='';
    q.oninput=e=>{ query=e.target.value; resetAndLoad(); };
    kwInp.oninput=e=>{ kw=e.target.value; resetAndLoad(); };
    sortSel && (sortSel.onchange=e=>{ sort=e.target.value; reset(); });
    btnCard && (btnCard.onclick=()=>{ view='card'; btnCard.classList.remove('ax-ghost'); btnList.classList.add('ax-ghost'); reset(); });
    btnList && (btnList.onclick=()=>{ view='list'; btnList.classList.remove('ax-ghost'); btnCard.classList.add('ax-ghost'); reset(); });
    favBtn && (favBtn.onclick=()=>{ favOnly=!favOnly; favBtn.textContent=favOnly?'⭐ Favorites: On':'⭐ Favorites: Off'; reset(); });
    moreBtn && (moreBtn.onclick=()=>{ page++; render(); refreshDownloadLink(); });
    dateSel && (dateSel.onchange=e=>{ day=e.target.value; resetAndLoad(); });

    renderChips();
    await loadHistoryList();
    await loadServer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  document.addEventListener('pjax:complete', boot, { once:true });
})();
