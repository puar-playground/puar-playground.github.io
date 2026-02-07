/* assets/js/arxiv-app.js
 * Daly arXiv News — dynamic client with MathJax support
 * Drop-in script for GitHub Pages + Jekyll (Chirpy)
 */

/* ---------------- 防重复初始化标记（不 return） ---------------- */
const __APP__ = document.getElementById('arxiv-app');
if (__APP__) {
  if (!__APP__.dataset.inited) {
    __APP__.dataset.inited = '1';
  }
}

/* ---------------- MathJax：稳健加载 + 排版 ---------------- */
let __MJX_PROMISE = null;
async function ensureMathJax() {
  if (window.MathJax?.typesetPromise) return;
  if (!__MJX_PROMISE) {
    __MJX_PROMISE = new Promise((resolve) => {
      if (!window.MathJax) {
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$','$$'], ['\\[','\\]']],
            processEscapes: true,
            processEnvironments: true
          },
          options: {
            skipHtmlTags: ['script','noscript','style','textarea','pre','code']
          },
          startup: {
            ready: () => {
              MathJax.startup.defaultReady();
              resolve();
            }
          }
        };
      }
      if (!document.getElementById('mjx-script')) {
        const s = document.createElement('script');
        s.id = 'mjx-script';
        s.async = true;
        s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js?v=3.2.2';
        s.onerror = () => { console.warn('MathJax load failed'); resolve(); };
        document.head.appendChild(s);
      }
      const tick = () => {
        if (window.MathJax?.typesetPromise) return resolve();
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  await __MJX_PROMISE;
}
async function typesetMath(scope){
  await ensureMathJax();
  try { await MathJax.typesetPromise(scope ? [scope] : undefined); }
  catch(e){ console.warn('MathJax typeset error:', e); }
}

/* ---------------- Config ---------------- */
const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';
const CATS = ['cs.CL','cs.LG','cs.AI','cs.SD','eess.AS','cs.CV','cs.MM','cs.IR','cs.NE','stat.ML'];
const BASE = document.querySelector('meta[name="baseurl"]')?.content || '';

/* ---------------- State & DOM ---------------- */
let ALL = [];
let query = '';
let kw = '';
let cat = null;
let sort = 'date_desc';
let view = 'card';
let favOnly = false;
let day = '';
let page = 0;
let pageSize = 12;

const $ = s => document.querySelector(s);
const app = () => document.getElementById('arxiv-app');
const grid = $('#ax-grid');
const chips = $('#ax-chips');
const qInp = $('#ax-q');
const kwInp = $('#ax-kw');
const countEl = $('#ax-count');
const sortSel = $('#ax-sort');
const btnCard = $('#ax-view-card');
const btnList = $('#ax-view-list');
const moreBtn = $('#ax-more');
const favBtn = $('#ax-fav-only');
const dateSel = $('#ax-date');
const refreshDatesBtn = $('#ax-refresh-dates');
const dl = $('#ax-download');

/* ---------------- Utils ---------------- */
const FKEY = 'arxiv:favs';
const favSet = new Set(JSON.parse(localStorage.getItem(FKEY) || '[]'));
const saveFavs = () => localStorage.setItem(FKEY, JSON.stringify([...favSet]));
const isFav = id => favSet.has(id);
const toggleFav = id => { isFav(id) ? favSet.delete(id) : favSet.add(id); saveFavs(); render(true); refreshDownloadLink(); };

function toast(msg, ms=2000){
  const t = document.createElement('div');
  t.className = 'ax-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]
  ));
}

/* 高亮：包含数学时跳过，避免破坏公式 */
function hl(text, q){
  const s = String(text || '');
  const hasMath = /(\$\$[\s\S]*?\$\$)|(\$[^$]*\$)|\\\(|\\\)|\\\[|\\\]/.test(s);
  if (!q || !q.trim() || hasMath) return escapeHTML(s);
  const esc = escapeHTML(s);
  try {
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return esc.replace(re, '<span class="ax-hl">$1</span>');
  } catch { return esc; }
}

/* BibTeX */
function bibtex(p){
  const id = (p.id || '').replace(/v\d+$/,'') || 'arxiv';
  const authors = (Array.isArray(p.authors) ? p.authors.join(' and ') : (p.authors || '')).replace(/&/g,'and');
  const year = (p.date || '').slice(0,4) || new Date().getUTCFullYear();
  const title = p.title || '';
  const pc = p.primary || 'cs';
  return `@misc{${id},
  title={${title}},
  author={${authors}},
  year={${year}},
  eprint={${id}},
  archivePrefix={arXiv},
  primaryClass={${pc}}
}`;
}
const copy = txt => navigator.clipboard.writeText(txt).then(() => toast('Copied'));

/* ---------------- 去重：按基本 arXiv ID 保留最高版本 ---------------- */
function normId(it) {
  const raw = it.id || it.arxiv_id || it.aid || it.identifier || it.url || '';
  let s = String(raw).trim();
  const m = s.match(/arxiv\.org\/(?:abs|pdf)\/([^?#/]+)(?:\.pdf)?/i);
  if (m) s = m[1];
  s = s.replace(/^arXiv:/i, '').trim();
  return s;
}
function parseArxivId(idStr) {
  const m = String(idStr).match(/^(.*?)(?:v(\d+))?$/i);
  if (!m) return { base: idStr, v: 1 };
  return { base: m[1], v: m[2] ? parseInt(m[2], 10) : 1 };
}
function dedupeKeepLatest(arr) {
  const map = new Map(); // base -> item(with _v)
  for (const it of arr) {
    const id = normId(it);
    if (!id) continue;
    const { base, v } = parseArxivId(id);
    const curV = Number.isFinite(v) ? v : (it.version || 1);
    const prev = map.get(base);
    if (!prev || curV > prev._v) {
      const copy = { ...it };
      copy._v = curV;
      copy._id = id;
      map.set(base, copy);
    }
  }
  return Array.from(map.values());
}

/* ---------------- Data fetch ---------------- */
// 可选开关：url?force_local=1 时走本地优先
const FORCE_LOCAL = new URLSearchParams(location.search).has('force_local');

// 建议把本地路径改成 Jekyll 相对路径（放在 MD 里会被编译）：
// const LOCAL_LATEST = "{{ '/assets/js/data/arxiv-latest.json' | relative_url }}";
const LOCAL_LATEST = `${BASE}/assets/js/data/arxiv-latest.json`;

async function fetchWithFallback(url){
  // Check if this is a history date request (not latest.json)
  const isHistoryDate = url.includes('/history/') && !url.includes('/latest.json');
  
  // Check if URL has filters (query parameters other than _t)
  const hasFilters = url.includes('?') && url.split('?')[1].split('&').some(param => 
    !param.startsWith('_t=') && param.split('=')[0] !== '_t'
  );
  
  // —— API 优先（除非强制本地）
  if (!FORCE_LOCAL) {
    try{
      const apiUrl = url + (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
      const r = await fetch(apiUrl, { cache:'no-store', mode:'cors' });
      if (!r.ok) {
        // If it's a specific history date request and returns 404, don't fallback
        if (isHistoryDate && r.status === 404) {
          throw new Error('Date not found');
        }
        throw new Error('HTTP ' + r.status);
      }
      return await r.json();
    }catch(err){
      // If it's a history date request, don't fallback to latest.json
      if (isHistoryDate) throw err;
      console.warn('API failed, will try local or proxy:', err.message);
    }
  }

  // —— 本地兜底（仅在无过滤且非历史日期时才有意义）
  if (!hasFilters && !isHistoryDate) {
    try{
      const localUrl = LOCAL_LATEST + `?_t=${Date.now()}`;
      const r = await fetch(localUrl, { cache:'no-store' });
      if (r.ok){
        const data = await r.json();
        if (Array.isArray(data) && data.length) return data;
      }
    }catch(e){}
  }

  // —— 最后兜底：CORS 代理（但历史日期请求失败时不使用）
  if (!isHistoryDate) {
    try{
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const r = await fetch(proxy, { cache:'no-store', mode:'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const o = await r.json();
      const parsed = typeof o.contents === 'string' ? JSON.parse(o.contents) : o.contents;
      return parsed;
    }catch(e2){
      console.warn('CORS proxy failed:', e2);
      throw e2;
    }
  }
  
  throw new Error('Date not found');
}



function buildDataURL(overrideDay = null){
  const selectedDay = overrideDay !== null ? (overrideDay.trim() || '') : ((day && day.trim()) ? day.trim() : '');
  const base = selectedDay ? `${API_BASE}/history/${selectedDay}.json` : `${API_BASE}/latest.json`;
  const qs = new URLSearchParams();
  if (query.trim()) qs.set('q', query.trim());
  if (kw.trim()) qs.set('kw', kw.trim());
  if (cat) qs.set('cat', cat);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}
function refreshDownloadLink(){
  let url = `${API_BASE}/history.zip`;
  const qs = new URLSearchParams();
  // Only restrict date range if explicitly needed (for now, download all files)
  // if (day){ qs.set('start', day); qs.set('end', day); }
  
  // Only apply filters if they're actually set (don't filter if empty)
  if (query.trim()) qs.set('q', query.trim());
  if (kw.trim()) qs.set('kw', kw.trim());
  if (cat) qs.set('cat', cat);
  
  // Only set filter=1 if there are actual filters to apply
  if (query.trim() || kw.trim() || cat) {
    qs.set('filter','1');
  }
  
  dl.href = (qs.toString() ? `${url}?${qs}` : url);
}
async function loadServer(opts = {}){
  const keepExisting = !!opts.keepExisting;
  const overrideDay = opts.day !== undefined ? opts.day : null;
  if (!keepExisting) skeleton();
  try{
    const url = buildDataURL(overrideDay);
    let data = await fetchWithFallback(url);
    if (!Array.isArray(data)) throw new Error('Response is not an array');
    ALL = dedupeKeepLatest(data);
    render(!keepExisting);
  }catch(e){
    const selectedDay = overrideDay !== null ? overrideDay : day;
    if (selectedDay && e.message && e.message.includes('not found')) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDay === today) {
        try {
          const latestUrl = buildDataURL('');
          const data = await fetchWithFallback(latestUrl);
          if (Array.isArray(data)) {
            ALL = dedupeKeepLatest(data);
            render(!keepExisting);
            return;
          }
        } catch(e2) {}
      }
    }
    console.error('Failed to load data:', e);
    if (keepExisting) {
      toast('Failed to load more items');
    } else {
      const selectedDay = overrideDay !== null ? overrideDay : day;
      const dateMsg = selectedDay ? ` for ${selectedDay}` : '';
      grid.innerHTML = `<div class="ax-card ax-empty" style="padding:2rem;text-align:center;">
        <p><strong>Failed to load data${dateMsg}.</strong></p>
        <p style="font-size:.85rem;opacity:.7;margin-top:.5rem;">Error: ${escapeHTML(e.message||String(e))}</p>
      </div>`;
    }
  }finally{
    refreshDownloadLink();
  }
}


async function loadHistoryList() {
  try {
    // ✅ 在追加之前清空 "Today" 以外的所有选项 (解决重复)
    while (dateSel.options.length > 1) dateSel.remove(1);

    const seen = new Set();   // ✅ Set 去重

    const pushOpt = (fn) => {
      const d = fn.replace(/\.json$/,'');
      if (!d || seen.has(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      seen.add(d);
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      dateSel.appendChild(opt);
    };

    // ✅ 优先使用 API（Railway），如果 API 成功则只使用 API 数据
    let apiSuccess = false;
    try {
      const r2 = await fetch(`${API_BASE}/history?_t=${Date.now()}`, { cache:'no-store', mode:'cors' });
      if (r2.ok) {
        const files2 = await r2.json();
        if (Array.isArray(files2)) {
          files2.forEach(pushOpt);
          apiSuccess = true;
        }
      }
    } catch(e) {
      console.warn("history list unavailable", e);
    }

    // 只有在 API 失败时才使用本地静态 history.json 作为后备
    if (!apiSuccess) {
      try {
        const r = await fetch(`${BASE}/assets/js/data/arxiv-history.json`, { cache:'no-store' });
        if (r.ok) {
          const files = await r.json();
          if (Array.isArray(files)) files.forEach(pushOpt);
        }
      } catch {}
    }

    // ✅ Sort options by date descending (newest on top)
    if (dateSel.options.length > 1) {
      const opts = Array.from(dateSel.options);
      const today = opts[0]; // Keep "Today" first
      const dateOpts = opts.slice(1); // All date options
      dateOpts.sort((a, b) => b.value.localeCompare(a.value)); // Newest first
      // Clear and re-add sorted
      while (dateSel.options.length > 1) dateSel.remove(1);
      dateOpts.forEach(opt => dateSel.appendChild(opt));
    }

  } catch (e) {
    console.warn("loadHistoryList() failed:", e);
  }
}

/* ---------------- UI helpers ---------------- */
function chip(label){
  const b = document.createElement('button');
  b.className = 'ax-chip' + (cat === label ? ' active' : '');
  b.textContent = label;
  b.onclick = () => { cat = (cat === label ? null : label); resetAndLoad(); };
  return b;
}
function renderChips(){
  const holder = document.getElementById('ax-chips');
  if (!holder) return;
  holder.innerHTML = '';
  CATS.forEach(c => holder.appendChild(chip(c)));
  if (cat){
    const x = chip('× clear');
    x.onclick = () => { cat = null; resetAndLoad(); };
    holder.appendChild(x);
  }
}
function filteredClient(){
  let arr = ALL.slice();
  
  // ✅ 类别过滤（与后端逻辑一致：primary 以 cat 开头）
  if (cat) {
    const filterCat = cat.trim();
    arr = arr.filter(p => {
      const primary = (p.primary || '').trim();
      return primary && primary.startsWith(filterCat);
    });
  }
  
  // ✅ 关键词过滤（kw：仅在标题中搜索）
  if (kw && kw.trim()) {
    const kwLower = kw.trim().toLowerCase();
    arr = arr.filter(p => {
      const title = (p.title || '').toLowerCase();
      return title.includes(kwLower);
    });
  }
  
  // ✅ 查询过滤（q：在标题/摘要/作者中搜索）
  if (query && query.trim()) {
    const qLower = query.trim().toLowerCase();
    arr = arr.filter(p => {
      const title = (p.title || '').toLowerCase();
      const abstract = (p.abstract || p.summary || '').toLowerCase();
      const authors = Array.isArray(p.authors) 
        ? p.authors.join(', ').toLowerCase() 
        : (p.authors || '').toLowerCase();
      const text = `${title} ${abstract} ${authors}`;
      return text.includes(qLower);
    });
  }
  
  // 排序
  arr.sort((a,b) => {
    const ad=a.date||'', bd=b.date||'';
    const at=(a.title||'').toLowerCase(), bt=(b.title||'').toLowerCase();
    const ac=(a.primary||''), bc=(b.primary||'');
    if (sort==='date_desc') return bd.localeCompare(ad) || at.localeCompare(bt);
    if (sort==='date_asc')  return ad.localeCompare(bd) || at.localeCompare(bt);
    if (sort==='title_asc') return at.localeCompare(bt);
    if (sort==='cat_asc')   return ac.localeCompare(bc) || bd.localeCompare(ad);
    return 0;
  });
  // 收藏置顶 / 仅收藏
  if (favOnly) arr = arr.filter(p => isFav((p.id||'').replace(/v\d+$/,'')));
  if (!favOnly){
    const F=[], N=[];
    arr.forEach(p => isFav((p.id||'').replace(/v\d+$/,'')) ? F.push(p) : N.push(p));
    arr = [...F, ...N];
  }
  return arr;
}
function iconStar(active){ return active ? '⭐' : '☆'; }
function cardHTML(p){
  const baseId = (p.id||'').replace(/v\d+$/,'');
  const title  = p.title || '';
  const authors= Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || '');
  const absUrl = p.abs || (baseId ? `https://arxiv.org/abs/${baseId}` : '#');
  const pdfUrl = p.pdf || (baseId ? `https://arxiv.org/pdf/${baseId}.pdf` : '#');
  const primary= p.primary || 'arXiv';
  const date   = p.date || '';
  const abstract = p.abstract || p.summary || '';
  const fav = isFav(baseId);

  if (view === 'card'){
    return `<article class="ax-card">
      <div class="ax-row">
        <h3 class="ax-title" style="flex:1 1 auto;">${hl(title, query)}</h3>
        <div class="ax-actions">
          <a href="${absUrl}" target="_blank" rel="noopener" class="ax-btn">abs</a>
          <a href="${pdfUrl}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
          <button class="ax-btn" data-bib="${baseId}" title="Copy BibTeX">BibTeX</button>
          <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}" title="Toggle favorite">${iconStar(fav)}</button>
        </div>
      </div>
      <div class="ax-meta">
        <span class="ax-badge">${primary}</span>
        ${date ? `<span class="ax-badge">${date}</span>` : ''}
        ${baseId ? `<span class="ax-badge">arXiv:${baseId}</span>` : ''}
      </div>
      <div class="ax-meta">${hl(authors, query)}</div>
      <details>
        <summary style="cursor:pointer;opacity:.88">Abstract</summary>
        <p class="ax-abs">${hl(abstract, query)}</p>
      </details>
    </article>`;
  }else{
    return `<article class="ax-card">
      <div class="ax-leftbar">
        <button class="ax-btn ax-ghost ax-star" data-fav="${baseId}" title="Toggle favorite">${iconStar(fav)}</button>
        ${date ? `<div class="ax-badge">${date}</div>` : ''}
        <div class="ax-badge">${primary}</div>
      </div>
      <div style="flex:1">
        <h3 class="ax-title">${hl(title, query)}</h3>
        <div class="ax-meta">${baseId ? `<span class="ax-badge">arXiv:${baseId}</span>` : ''}</div>
        <div class="ax-meta">${hl(authors, query)}</div>
        <details>
          <summary style="cursor:pointer;opacity:.88">Abstract</summary>
          <p class="ax-abs">${hl(abstract, query)}</p>
        </details>
        <div class="ax-links">
          <a href="${absUrl}" target="_blank" rel="noopener" class="ax-btn">abs</a>
          <a href="${pdfUrl}" target="_blank" rel="noopener" class="ax-btn">pdf</a>
          <button class="ax-btn" data-bib="${baseId}" title="Copy BibTeX">Copy BibTeX</button>
        </div>
      </div>
    </article>`;
  }
}
function attachActions(scope){
  scope.querySelectorAll('[data-bib]').forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute('data-bib');
      const p = ALL.find(x => (x.id||'').replace(/v\d+$/,'') === id);
      if (p) copy(bibtex(p));
    };
  });
  scope.querySelectorAll('[data-fav]').forEach(b => {
    b.onclick = () => toggleFav(b.getAttribute('data-fav'));
  });
  scope.querySelectorAll('details > summary').forEach(sum => {
    sum.addEventListener('click', () => {
      setTimeout(() => typesetMath(app()), 0);
    });
  });
}
function skeleton(n=6){
  grid.innerHTML = Array.from({length: n}).map(() => `<div class="ax-skel"></div>`).join('');
}
function render(resetLayout=false){
  renderChips();

  const items = filteredClient();
  if (resetLayout) grid.classList.toggle('ax-list', view === 'list');

  const total = items.length;
  const start = page * pageSize;
  const end   = Math.min(start + pageSize, total);

  if (start === 0) grid.innerHTML = '';
  const chunk = items.slice(start, end);

  if (chunk.length === 0 && total === 0 && start === 0){
    grid.innerHTML = `<div class="ax-card ax-empty" style="padding:2rem;text-align:center;">
      <p>No papers found.</p>
      <p style="font-size:.85rem;opacity:.7;margin-top:.5rem;">Try adjusting your search or filters.</p>
    </div>`;
  }else{
    const frag = document.createElement('div');
    frag.innerHTML = chunk.map(cardHTML).join('');
    attachActions(frag);
    grid.append(...frag.childNodes);
  }

  if (countEl) countEl.textContent =
    `${total} item${total!==1?'s':''}${cat?` · ${cat}`:''}${query?` · "${query}"`:''}${kw?` · kw:${kw}`:''}${favOnly?' · ⭐':''}${day?` · ${day}`:' · Today'}`;

  if (moreBtn) moreBtn.style.display = (end < total ? 'block' : 'none');

  typesetMath(app());
}
function reset(){ page = 0; grid.innerHTML=''; render(true); refreshDownloadLink(); }
function resetAndLoad(){ 
  page = 0; 
  grid.innerHTML = ''; // Clear existing content
  loadServer(); 
}

/* ---------------- Boot ---------------- */
async function boot(){
  // ✅ 防止 boot 被 PJAX 或 DOM 再次调用
  const el = document.getElementById('arxiv-app');
  if (!el || el.dataset.booted === '1') return;
  el.dataset.booted = '1';
  
  if (!grid || !qInp || !kwInp) return;

  qInp.value = ''; kwInp.value = '';
  query=''; kw=''; cat=null; sort='date_desc'; view='card'; favOnly=false; day='';

  qInp.oninput   = e => { query = e.target.value; resetAndLoad(); };
  kwInp.oninput  = e => { kw = e.target.value; resetAndLoad(); };
  sortSel.onchange = e => { sort = e.target.value; reset(); };
  btnCard.onclick = () => { view='card'; btnCard.classList.remove('ax-ghost'); btnList.classList.add('ax-ghost'); reset(); };
  btnList.onclick = () => { view='list'; btnList.classList.remove('ax-ghost'); btnCard.classList.add('ax-ghost'); reset(); };
  favBtn.onclick  = () => { favOnly=!favOnly; favBtn.textContent = favOnly ? '⭐ Favorites: On' : '⭐ Favorites: Off'; reset(); };
  moreBtn.onclick = () => { page++; loadServer({ keepExisting: true }); };
  dateSel.onchange= e => { 
    day = e.target.value ? e.target.value.trim() : '';
    page = 0;
    grid.innerHTML = '';
    ALL = [];
    loadServer({ day });
  };
  
  // Refresh date list button
  if (refreshDatesBtn) {
    refreshDatesBtn.onclick = async () => {
      refreshDatesBtn.disabled = true;
      refreshDatesBtn.textContent = '⏳';
      await loadHistoryList();
      refreshDatesBtn.disabled = false;
      refreshDatesBtn.textContent = '🔄';
      toast('Date list refreshed');
    };
  }
  
  // Auto-refresh date list every 60 seconds
  setInterval(() => {
    loadHistoryList().catch(e => console.warn('Auto-refresh date list failed:', e));
  }, 60000);

  renderChips();
  await ensureMathJax();
  await loadHistoryList();
  await loadServer();
  bindThemeToggleOnce();
}


/* ---------------- DOM Ready / PJAX ---------------- */
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else { boot(); }
document.addEventListener('pjax:complete', () => {
  const appEl = document.getElementById('arxiv-app');
  if (appEl && appEl.dataset.inited !== '1') boot();
}, { passive: true });


/* ---------------- 主题切换 & 顶栏兜底 ---------------- */
(function setupPjaxHook(){
  if (window.__axPjaxHooked) return;
  window.__axPjaxHooked = true;

  document.addEventListener('pjax:complete', () => {
    try { bindThemeToggleOnce(); } catch (e) { console.warn(e); }
  });

  try {
    const mo = new MutationObserver(() => { bindThemeToggleOnce(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 3000);
  } catch(_) {}
})();

function bindThemeToggleOnce() {
  const btn = document.querySelector('.mode-toggle');
  if (!btn || btn.dataset.axBound) return;

  function getModeInstance() {
    if (window.__axModeToggle) return window.__axModeToggle;
    if (typeof window.ModeToggle === 'function') {
      window.__axModeToggle = new window.ModeToggle();
      return window.__axModeToggle;
    }
    return null;
  }

  btn.addEventListener('click', () => {
    try {
      const inst = getModeInstance();
      if (inst && typeof inst.flipMode === 'function') {
        inst.flipMode();
      } else {
        const root = document.documentElement;
        const cur  = root.getAttribute('data-mode');
        const next = cur === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-mode', next);
        try { sessionStorage.setItem('mode', next); } catch {}
        window.postMessage({ direction: 'mode-toggle', message: next }, '*');
      }
    } catch (err) {
      console.warn('Theme toggle fallback failed:', err);
    }
  }, { passive: true });

  btn.dataset.axBound = '1';
}

function bindChirpyTopbarFallback() {
  try {
    const sideBtn = document.getElementById('sidebar-trigger');
    if (sideBtn && !sideBtn.dataset.axBound) {
      sideBtn.addEventListener('click', () => {
        const root = document.documentElement;
        if (root.hasAttribute('sidebar-display')) {
          root.removeAttribute('sidebar-display');
        } else {
          root.setAttribute('sidebar-display', '');
        }
      });
      sideBtn.dataset.axBound = '1';
    }

    const searchBtn  = document.getElementById('search-trigger');
    const cancelBtn  = document.getElementById('search-cancel');
    const resultWrap = document.getElementById('search-result-wrapper');
    const input      = document.getElementById('search-input');

    if (searchBtn && resultWrap && !searchBtn.dataset.axBound) {
      searchBtn.addEventListener('click', () => {
        resultWrap.classList.remove('unloaded');
        if (input) input.focus();
      });
      searchBtn.dataset.axBound = '1';
    }
    if (cancelBtn && resultWrap && !cancelBtn.dataset.axBound) {
      cancelBtn.addEventListener('click', () => {
        resultWrap.classList.add('unloaded');
      });
      cancelBtn.dataset.axBound = '1';
    }
  } catch (e) {
    console.warn('[arxiv] topbar fallback failed:', e);
  }
}
document.addEventListener('DOMContentLoaded', () => { try { bindChirpyTopbarFallback(); } catch(_) {} });
document.addEventListener('pjax:complete', () => { try { bindChirpyTopbarFallback(); } catch(_) {} });

const _origBoot = typeof boot === 'function' ? boot : null;
async function safeBoot() {
  try { if (_origBoot) await _origBoot(); }
  catch (e) { console.error('[arxiv] boot error:', e); }
}
if (_origBoot) {
  document.removeEventListener('DOMContentLoaded', _origBoot);
  document.removeEventListener('pjax:complete', _origBoot);
  document.addEventListener('DOMContentLoaded', safeBoot);
  document.addEventListener('pjax:complete', safeBoot);
}

// Close sidebar when tapping outside it — scoped to /arxiv/ only
(function () {
  const root = document.getElementById('arxiv-app');
  if (!root) return;

  root.addEventListener('click', function (e) {
    const html = document.documentElement;
    // only act if sidebar is currently open
    if (!html.hasAttribute('sidebar-display')) return;

    const t = e.target;
    // don't close if click is on the trigger button or inside the sidebar
    if (t.closest('#sidebar') || t.closest('#sidebar-trigger')) return;

    // close sidebar safely
    html.removeAttribute('sidebar-display');
  }, { passive: true });
})();





// ########################################################################
// /arxiv/: keep mask off the sidebar, so sidebar stays clickable
(() => {
  const app = document.getElementById('arxiv-app');
  if (!app) return;

  const html    = document.documentElement;
  const mask    = document.getElementById('mask');
  const sidebar = document.getElementById('sidebar');
  if (!mask || !sidebar) return;

  function applyMaskBounds() {
    // If sidebar is closed, let theme do its thing
    if (!html.hasAttribute('sidebar-display')) {
      mask.style.left = '';
      return;
    }
    // Measure sidebar width and keep mask to the right of it
    const w = sidebar.getBoundingClientRect().width || 300; // fallback
    mask.style.left = w + 'px';
  }

  // Observe sidebar open/close
  const mo = new MutationObserver(applyMaskBounds);
  mo.observe(html, { attributes: true, attributeFilter: ['sidebar-display'] });

  // Update on resize and PJAX nav
  window.addEventListener('resize', applyMaskBounds, { passive: true });
  document.addEventListener('pjax:complete', applyMaskBounds, { passive: true });

  // Initial run
  applyMaskBounds();
})();

