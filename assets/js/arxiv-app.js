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
  // —— API 优先（除非强制本地）
  if (!FORCE_LOCAL) {
    try{
      const apiUrl = url + (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`; // 防缓存
      const r = await fetch(apiUrl, { cache:'no-store', mode:'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      console.log('Loaded from API');
      return data;
    }catch(err){
      console.warn('API failed, will try local or proxy:', err.message);
      // 不中断，继续尝试本地/代理
    }
  }

  // —— 本地兜底（仅在首页/无过滤时才有意义）
  try{
    const localUrl = LOCAL_LATEST + `?_t=${Date.now()}`;
    const r = await fetch(localUrl, { cache:'no-store' });
    if (r.ok){
      const data = await r.json();
      if (Array.isArray(data) && data.length){
        console.log('Loaded from local latest.json');
        return data;
      }
    }
  }catch(e){ console.log('Local latest.json not available'); }

  // —— 最后兜底：CORS 代理
  try{
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { cache:'no-store', mode:'cors' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const o = await r.json();
    const parsed = typeof o.contents === 'string' ? JSON.parse(o.contents) : o.contents;
    console.log('Loaded via CORS proxy');
    return parsed;
  }catch(e2){
    console.warn('CORS proxy failed:', e2);
    throw e2; // 全部失败才抛
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
  qs.set('filter','1');
  dl.href = (qs.toString() ? `${url}?${qs}` : url);
}
async function loadServer(){
  skeleton();
  try{
    const url = buildDataURL();
    let data = await fetchWithFallback(url);
    if (!Array.isArray(data)) throw new Error('Response is not an array');
    // ✅ 去重并保留最新版本
    ALL = dedupeKeepLatest(data);
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

// async function loadHistoryList(){
//   try{
//     try{
//       const r = await fetch(`${BASE}/assets/js/data/arxiv-history.json`, {cache:'no-store'});
//       if (r.ok){
//         const files = await r.json();
//         if (Array.isArray(files)){
//           files.forEach(fn => {
//             const d = fn.replace(/\.json$/,'');
//             const opt = document.createElement('option');
//             opt.value = d; opt.textContent = d;
//             dateSel.appendChild(opt);
//           });
//           return;
//         }
//       }
//     }catch{ /* ignore */ }
//     const r2 = await fetch(`${API_BASE}/history`, {cache:'no-store', mode:'cors'});
//     if (!r2.ok) throw new Error('HTTP ' + r2.status);
//     const files2 = await r2.json();
//     if (Array.isArray(files2)){
//       files2.forEach(fn => {
//         const d = fn.replace(/\.json$/,'');
//         const opt = document.createElement('option');
//         opt.value = d; opt.textContent = d;
//         dateSel.appendChild(opt);
//       });
//     }
//   }catch(e){ console.warn('history list unavailable:', e); }
// }

async function loadHistoryList() {
  try {
    // ✅ 在追加之前清空 “Today” 以外的所有选项 (解决重复)
    while (dateSel.options.length > 1) dateSel.remove(1);

    const seen = new Set();   // ✅ Set 去重

    const pushOpt = (fn) => {
      const d = fn.replace(/\.json$/,'');
      if (!d || seen.has(d)) return;
      seen.add(d);
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      dateSel.appendChild(opt);
    };

    // 先尝试本地 history.json
    try {
      const r = await fetch(`${BASE}/assets/js/data/arxiv-history.json`, { cache:'no-store' });
      if (r.ok) {
        const files = await r.json();
        if (Array.isArray(files)) files.forEach(pushOpt);
      }
    } catch {}

    // 再去 API 取（Railway），补全本地缺的
    try {
      const r2 = await fetch(`${API_BASE}/history`, { cache:'no-store', mode:'cors' });
      if (r2.ok) {
        const files2 = await r2.json();
        if (Array.isArray(files2)) files2.forEach(pushOpt);
      }
    } catch(e) {
      console.warn("history list unavailable", e);
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
function resetAndLoad(){ page = 0; loadServer(); }

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
  moreBtn.onclick = () => { page++; render(); refreshDownloadLink(); };
  dateSel.onchange= e => { day = e.target.value; resetAndLoad(); };

  renderChips();
  await ensureMathJax();
  await loadHistoryList();
  await loadServer();
  bindThemeToggleOnce();
}

/* DOM Ready / PJAX */
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


document.addEventListener('click', () => {
  const root = document.documentElement;
  if (root.hasAttribute('sidebar-display')) {
    root.removeAttribute('sidebar-display');
  }
});
