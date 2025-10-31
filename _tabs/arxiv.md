---
layout: page
title: Daily arXiv News
icon: far fa-lightbulb
permalink: /arxiv/
order: 2
---

<style>
  .plain-wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
  .plain-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .plain-input{flex:1;min-width:220px;padding:.5rem .6rem;border:1px solid #ddd;border-radius:8px}
  .plain-btn{padding:.45rem .7rem;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer}
  .plain-card{padding:.7rem .9rem;border:1px solid #eee;border-radius:10px}
  .plain-muted{opacity:.7}
  .plain-error{color:#c0392b}
  .plain-badge{display:inline-block;margin-right:.5rem;padding:.12rem .4rem;border:1px solid #eee;border-radius:6px;font-size:.8rem}
</style>

<div class="plain-wrap" id="ax">
  <div class="plain-toolbar">
    <input id="q"  class="plain-input" placeholder="Search (title/abstract/authors)">
    <input id="kw" class="plain-input" placeholder="Keywords OR (comma-separated)">
    <button id="reload" class="plain-btn">Reload</button>
    <span id="status" class="plain-muted"></span>
  </div>

  <div id="list"></div>
</div>

<script>
(function(){
  // --- CONFIG: change this if your backend URL changes ---
  const API_BASE = 'https://arxiv-backend-production.up.railway.app/arxiv';

  const $ = s => document.querySelector(s);
  const list = $('#list'), q = $('#q'), kw = $('#kw'), status = $('#status');

  function esc(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  function buildURL(){
    const u = new URL(API_BASE + '/latest.json');
    if (q.value.trim())  u.searchParams.set('q', q.value.trim());
    if (kw.value.trim()) u.searchParams.set('kw', kw.value.trim());
    u.searchParams.set('limit', '100');
    return u.toString();
  }

  function card(p){
    const id = (p.id||'').replace(/v\d+$/,'');
    const abs = p.abs || ('https://arxiv.org/abs/' + id);
    const pdf = p.pdf || ('https://arxiv.org/pdf/' + id + '.pdf');
    return `
      <article class="plain-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <h3 style="margin:0 0 .35rem 0;line-height:1.2">${esc(p.title||'')}</h3>
          <div style="white-space:nowrap;flex-shrink:0">
            <a class="plain-btn" href="${abs}" target="_blank" rel="noopener">abs</a>
            <a class="plain-btn" href="${pdf}" target="_blank" rel="noopener">pdf</a>
          </div>
        </div>
        <div class="plain-muted" style="margin:.2rem 0 .5rem 0">
          <span class="plain-badge">${esc(p.primary||'arXiv')}</span>
          ${p.date ? `<span class="plain-badge">${esc(p.date)}</span>` : ''}
          ${id ? `<span class="plain-badge">arXiv:${esc(id)}</span>` : ''}
        </div>
        <div class="plain-muted">${esc((Array.isArray(p.authors)?p.authors.join(', '):p.authors)||'')}</div>
        ${p.abstract ? `<details style="margin-top:.4rem"><summary>Abstract</summary><p>${esc(p.abstract)}</p></details>` : ''}
      </article>
    `;
  }

  async function load(){
    list.innerHTML = '<div class="plain-muted">Loading…</div>';
    status.textContent = '';
    try{
      const url = buildURL();
      const r = await fetch(url, {cache:'no-store'});
      if(!r.ok) throw new Error('HTTP ' + r.status);
      const items = await r.json();
      if(!Array.isArray(items) || items.length===0){
        list.innerHTML = '<div class="plain-muted">No items.</div>';
      }else{
        list.innerHTML = items.map(card).join('');
      }
      status.textContent = `${items.length} item${items.length!==1?'s':''}`;
    }catch(err){
      list.innerHTML = '<div class="plain-error">Failed to load. Open console for details.</div>';
      console.error(err);
    }
  }

  // events
  $('#reload').onclick = load;
  q.oninput = () => load();
  kw.oninput = () => load();

  // initial
  document.addEventListener('DOMContentLoaded', load);
})();
</script>
