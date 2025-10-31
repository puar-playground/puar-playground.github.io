/* assets/js/arxiv-app.js
 * Daly arXiv News — dynamic client with MathJax support
 * Drop-in script for GitHub Pages + Jekyll (Chirpy)
 */

/* ---- MathJax robust loader (works on GitHub Pages) ---- */
let __MJX_PROMISE = null;

async function ensureMathJax() {
  if (window.MathJax?.typesetPromise) return; // already ready

  if (!__MJX_PROMISE) {
    __MJX_PROMISE = new Promise((resolve) => {
      // 1) config MUST be set before script tag is evaluated
      if (!window.MathJax) {
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$','$$'], ['\\[','\\]']],
            processEscapes: true
          },
          options: {
            skipHtmlTags: { '[-]': ['script','noscript','style','textarea','pre','code'] }
          },
          startup: {
            // we’ll control when to typeset; just resolve when ready
            ready: () => {
              MathJax.startup.defaultReady();
              resolve();
            }
          }
        };
      }

      // 2) inject script if not present
      if (!document.getElementById('mjx-script')) {
        const s = document.createElement('script');
        s.id = 'mjx-script';
        s.async = true;
        // 固定 v3 主线；加个 cache bust 避免 GH Pages 老缓存
        s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js?v=3.2.2';
        s.onerror = () => { console.warn('MathJax load failed'); resolve(); };
        document.head.appendChild(s);
      }

      // 3) double-guard: if ready wasn’t hit (e.g., cached), poll typesetPromise
      const tick = () => {
        if (window.MathJax?.typesetPromise) return resolve();
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  await __MJX_PROMISE;
}

/* 改造原来的 typeset 函数：先确保 MathJax 到位再排版 */
async function typesetMath(scope){
  await ensureMathJax();
  try {
    await MathJax.typesetPromise(scope ? [scope] : undefined);
  } catch (e) {
    console.warn('MathJax typeset error:', e);
  }
}


/* ===================== Config ===================== */
const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';
const CATS = ['cs.CL','cs.LG','cs.AI','cs.SD','eess.AS','cs.CV','cs.MM','cs.IR','cs.NE','stat.ML'];
// 从 <meta name="baseurl" content="..."> 读取站点 baseurl（在 arxiv.md 里我们已注入）
const BASE = document.querySelector('meta[name="baseurl"]')?.content || '';

/* ===================== State & DOM ===================== */
let ALL = [];                 // 当前已加载的数据（数组）
let query = '';               // q= 文本检索（title/abstract/authors）
let kw = '';                  // kw= 关键词（逗号分隔）
let cat = null;               // 当前选中分类
let sort = 'date_desc';       // 排序
let view = 'card';            // 视图：card/list
let favOnly = false;          // 只看收藏
let day = '';                 // 历史日期（yyyy-mm-dd）
let page = 0;                 // 前端分页页码
let pageSize = 12;            // 每页条数

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
const dl = $('#ax-download');

/* ===================== Utils ===================== */
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

/* 高亮：若包含数学分隔符，则跳过高亮以免破坏公式（简洁稳妥版） */
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

/* MathJax：对指定 scope 进行 typeset（动态 DOM 必需） */
function typesetMath(scope){
  if (window.MathJax && MathJax.typesetPromise) {
    return MathJax.typesetPromise([scope]).catch(err => console.warn('MathJax typeset error:', err));
  }
}

/* ===================== Data fetch ===================== */
/* 优先尝试本地 JSON（避免 CORS），失败再走 API，最后兜底 CORS 代理 */
async function fetchWithFallback(url){
  const hasFilters = query.trim() || kw.trim() || cat || day; // 本地 latest.json 仅用于“当天且无过滤”
  if (!hasFilters){
    try{
      const localUrl = `${BASE}/assets/js/data/arxiv-latest.json`;
      const r = await fetch(localUrl, {cache:'no-store'});
      if (r.ok){
        const data = await r.json();
        if (Array.isArray(data) && data.length) {
          console.log('Loaded from local latest.json');
          return data;
        }
      }
    }catch(e){ console.log('Local latest.json not available'); }
  }
  // API
  try{
    const r = await fetch(url, {cache:'no-store', mode:'cors'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    console.log('Loaded from API');
    return data;
  }catch(err){
    if (String(err).includes('CORS') || String(err).includes('Failed to fetch')){
      try{
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const r = await fetch(proxy, {cache:'no-store', mode:'cors'});
        if (r.ok){
          const o = await r.json();
          const parsed = typeof o.contents === 'string' ? JSON.parse(o.contents) : o.contents;
          console.log('Loaded via CORS proxy');
          return parsed;
        }
      }catch(e2){ console.warn('CORS proxy failed:', e2); }
    }
    throw err;
  }
}

function buildDataURL(){
  const base = day ? `${API_BASE}/history/${day}.json` : `${API_BASE}/latest.json`;
  const qs = new URLSearchParams();
  if (query.trim()) qs.set('q', query.trim());
  if (kw.trim()) qs.set('kw', kw.trim());
  if (cat) qs.set('cat', cat);
  qs.set('limit', String((page+1)*pageSize));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function refreshDownloadLink(){
  let url = `${API_BASE}/history.zip`;
  const qs = new URLSearchParams();
  if (day){ qs.set('start', day); qs.set('end', day); }
  if (query.trim()) qs.set('q', query.trim());
  if (kw.trim()) qs.set('kw', kw.trim());
  if (cat) qs.set('cat', cat);
  qs.set('filter','1'); // 仅打包过滤后的
  dl.href = (qs.toString() ? `${url}?${qs}` : url);
}

async function loadServer(){
  skeleton();
  try{
    const url = buildDataURL();
    ALL = await fetchWithFallback(url);
    if (!Array.isArray(ALL)) throw new Error('Response is not an array');
    render(true);
  }catch(e){
    console.error('Failed to load data:', e);
    grid.innerHTML = `<div class="ax-card ax-empty" style="padding:2rem;text-align:center;">
      <p><strong>Failed to load arXiv feed.</strong></p>
      <p style="font-size:.85rem;opacity:.7;margin-top:.5rem;">Error: ${escapeHTML(e.message||String(e))}</p>
    </div>`;
  }finally{
    refreshDownloadLink();
  }
}

async function loadHistoryList(){
  try{
    // 先尝试本地 arxiv-history.json
    try{
      const r = await fetch(`${BASE}/assets/js/data/arxiv-history.json`, {cache:'no-store'});
      if (r.ok){
        const files = await r.json();
        if (Array.isArray(files)){
          files.forEach(fn => {
            const d = fn.replace(/\.json$/,'');
            const opt = document.createElement('option');
            opt.value = d; opt.textContent = d;
            dateSel.appendChild(opt);
          });
          return;
        }
      }
    }catch{ /* ignore */ }
    // 再尝试 API
    const r2 = await fetch(`${API_BASE}/history`, {cache:'no-store', mode:'cors'});
    if (!r2.ok) throw new Error('HTTP ' + r2.status);
    const files2 = await r2.json();
    if (Array.isArray(files2)){
      files2.forEach(fn => {
        const d = fn.replace(/\.json$/,'');
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        dateSel.appendChild(opt);
      });
    }
  }catch(e){ console.warn('history list unavailable:', e); }
}

/* ===================== UI helpers ===================== */
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
  // 摘要详情展开时再 typeset 一次，确保布局后渲染
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

  // ✅ 对刚刚渲染出的 DOM 进行公式排版
  typesetMath(app());
}

function reset(){ page = 0; grid.innerHTML=''; render(true); refreshDownloadLink(); }
function resetAndLoad(){ page = 0; loadServer(); }

/* ===================== Boot ===================== */
async function boot(){
  if (!grid || !qInp || !kwInp) return;

  // 初始控件
  qInp.value = ''; kwInp.value = '';
  query=''; kw=''; cat=null; sort='date_desc'; view='card'; favOnly=false; day='';

  qInp.oninput   = e => { query = e.target.value; resetAndLoad(); };
  kwInp.oninput  = e => { kw = e.target.value; resetAndLoad(); };
  sortSel.onchange = e => { sort = e.target.value; reset(); };
  btnCard.onclick = () => { view='card'; btnCard.classList.remove('ax-ghost'); btnList.classList.add('ax-ghost'); reset(); };
  btnList.onclick = () => { view='list'; btnList.classList.remove('ax-ghost'); btnCard.classList.add('ax-ghost'); reset(); };
  favBtn.onclick  = () => { favOnly=!favOnly; favBtn.textContent = favOnly ? '⭐ Favorites: On' : '⭐ Favorites: Off'; reset(); };
  moreBtn.onclick = () => { page++; render(); refreshDownloadLink(); };
  dateSel.onchange= e => { day = e.target.value; resetAndLoad(); };

  // 先画 chips 再加载数据
  renderChips();
  await ensureMathJax();
  await loadHistoryList();
  await loadServer();
  bindThemeToggleOnce(); 
}

// DOM Ready / PJAX
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else { boot(); }
document.addEventListener('pjax:complete', boot);

/* ===== 在 PJAX 完成后重绑主题按钮（不会报错，没 PJAX 也没关系） ===== */
(function setupPjaxHook(){
  if (window.__axPjaxHooked) return;           // 防重复安装
  window.__axPjaxHooked = true;

  // Chirpy 会在局部加载后触发这个事件；不存在也不会报错
  document.addEventListener('pjax:complete', () => {
    try { bindThemeToggleOnce(); } catch (e) { console.warn(e); }
  });

  // 保险：某些情况下按钮是后插入的，用一次性 MutationObserver 兜底
  try {
    const mo = new MutationObserver(() => { bindThemeToggleOnce(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // 观察 3 秒足够覆盖 PJAX 切换过程，随后自动停止
    setTimeout(() => mo.disconnect(), 3000);
  } catch(_) {}
})();



/* ===== Hotfix: re-bind theme toggle on this page (Chirpy-compatible) ===== */
function bindThemeToggleOnce() {
  const btn = document.querySelector('.mode-toggle');   // 主题右上角按钮
  if (!btn || btn.dataset.axBound) return;              // 防重复绑定

  // 拿到或创建一个 ModeToggle 实例（主题里用 const，不挂 window）
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
        inst.flipMode();                       // ✅ 走主题原生切换
      } else {
        // 兜底方案：直接切换 html[data-mode] & sessionStorage
        const root = document.documentElement;
        const cur  = root.getAttribute('data-mode');
        const next = cur === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-mode', next);
        try { sessionStorage.setItem('mode', next); } catch {}
        // 通知其他监听者（主题里会用 postMessage 同步）
        window.postMessage({ direction: 'mode-toggle', message: next }, '*');
      }
    } catch (err) {
      console.warn('Theme toggle fallback failed:', err);
    }
  }, { passive: true });

  btn.dataset.axBound = '1';
}
