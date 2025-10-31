---
layout: page
title: Daly arXiv News
permalink: /arxiv/
order: 2
---

<style>
  .wrap{max-width:920px;margin:0 auto;padding:0}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .in{flex:1;min-width:220px;padding:.45rem .6rem;border:1px solid #ddd;border-radius:6px}
  .btn{padding:.45rem .7rem;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer}
  .muted{opacity:.7}
  .card{padding:.7rem .9rem;border:1px solid #eee;border-radius:8px;margin-bottom:10px}
  .badges{margin:.2rem 0 .5rem 0}
  .badge{display:inline-block;margin-right:.4rem;padding:.1rem .35rem;border:1px solid #eee;border-radius:6px;font-size:.8rem}
</style>

<div class="wrap">
  <div class="row">
    <select id="day" class="in" style="max-width:180px">
      <option value="">Today</option>
    </select>
    <input id="q"  class="in" placeholder="Search (title/abstract/authors)">
    <input id="kw" class="in" placeholder="Keywords OR (comma-separated)">
    <button id="reload" class="btn">Reload</button>
    <span id="status" class="muted"></span>
  </div>

  <div id="list"></div>
</div>

<script>
(function(){
  const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';

  const $ = s => document.querySelector(s);
  const list = $('#list'), q = $('#q'), kw = $('#kw'), status = $('#status'), daySel = $('#day');

  function esc(s){ return (s||'').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function buildURL(){
    const base = daySel.value ? `${API_BASE}/history/${daySel.value}.json` : `${API_BASE}/latest.json`;
    const u = new URL(base);
    if (q.value.trim())  u.searchParams.set('q', q.value.trim());
    if (kw.value.trim()) u.searchParams.set('kw', kw.value.trim());
    u.searchParams.set('limit','100');
    return u.toString();
  }

  function card(p){
    const id = (p.id||'').replace(/v\d+$/,'');
    const abs = p.abs || (id ? `https://arxiv.org/abs/${id}` : '#');
    const pdf = p.pdf || (id ? `https://arxiv.org/pdf/${id}.pdf` : '#');
    return `
      <article class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <h3 style="margin:0 0 .35rem 0;line-height:1.2">${esc(p.title||'')}</h3>
          <div style="white-space:nowrap;flex-shrink:0">
            <a class="btn" href="${abs}" target="_blank" rel="noopener">abs</a>
            <a class="btn" href="${pdf}" target="_blank" rel="noopener">pdf</a>
          </div>
        </div>
        <div class="badges">
          <span class="badge">${esc(p.primary||'arXiv')}</span>
          ${p.date ? `<span class="badge">${esc(p.date)}</span>` : ''}
          ${id ? `<span class="badge">arXiv:${esc(id)}</span>` : ''}
        </div>
        <div class="muted">${esc(Array.isArray(p.authors)?p.authors.join(', '):(p.authors||''))}</div>
        ${p.abstract ? `<details style="margin-top:.4rem"><summary>Abstract</summary><p>${esc(p.abstract)}</p></details>` : ''}
      </article>
    `;
  }

  async function load(){
    list.innerHTML = '<div class="muted">Loading…</div>';
    status.textContent = '';
    try{
      const url = buildURL();
      const r = await fetch(url, {cache:'no-store'});  // requires backend CORS allow for your origin
      if(!r.ok) throw new Error('HTTP '+r.status);
      const items = await r.json();
      list.innerHTML = (Array.isArray(items) && items.length)
        ? items.map(card).join('')
        : '<div class="muted">No items.</div>';
      status.textContent = `${Array.isArray(items)?items.length:0} item(s) ${daySel.value ? '· '+daySel.value : '· Today'}`;
    }catch(err){
      list.innerHTML = '<div style="color:#c0392b">Failed to load. Open console for details.</div>';
      console.error(err);
    }
  }

  async function loadHistoryList(){
    try{
      const r = await fetch(`${API_BASE}/history`, {cache:'no-store'});
      if(!r.ok) return;
      const files = await r.json();
      if(Array.isArray(files)){
        files.forEach(fn=>{
          const d = fn.replace(/\.json$/,'');
          const opt = document.createElement('option');
          opt.value = d; opt.textContent = d;
          daySel.appendChild(opt);
        });
      }
    }catch{}
  }

  // wire up
  $('#reload').onclick = load;
  q.oninput  = () => load();
  kw.oninput = () => load();
  daySel.onchange = () => load();

  async function boot(){ await loadHistoryList(); await load(); }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // If you navigate here via PJAX, inline scripts won't run; prefer direct load or disable PJAX on the nav link to /arxiv/.
})();
</script>
