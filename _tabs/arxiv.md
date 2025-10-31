---
layout: page
title: Daily arXiv Digest
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

  <div id="ax-chips" class="ax-row"></div>

  <div id="ax-grid" class="ax-grid"></div>
  <button id="ax-more" class="ax-btn" style="display:none;margin:0 auto;">Load more</button>

  <div class="ax-footer">
    <a id="ax-download" class="ax-download" href="#" rel="noopener" download>
      Download all history (ZIP)
    </a>
  </div>
</div>
