---
title: Daily arXiv News Online!!!
date: 2025-10-31 00:00:00 +500
categories: [Social, News]
tags: [social]
---

## 📌 New Feature: DAILY ARXIV NEWS
I just added a new dynamic page to my website — a Daily arXiv paper tracker that automatically fetches and filters newly released research papers based on my interests (multimodal LLMs, audio/speech, machine learning, etc.). The page updates automatically every day. 

It’s also pinned 📌 in the sidebar as: "DAILY ARXIV NEWS"

---

<!-- 独立样式（可选）：在 assets/css/arxiv.css 里放你的 .ax-* 样式 -->
<link rel="stylesheet" href="{{ '/assets/css/arxiv.css' | relative_url }}">

<!-- 提供给前端 JS 的 baseurl（GitHub Pages 根仓库通常为空串） -->
<meta name="baseurl" content="{{ site.baseurl | default: '' }}">

<!-- ✅ Chirpy expects #search to exist; provide a harmless stub -->
<div id="search" hidden></div>

<div class="ax-wrap" id="arxiv-app">
  <div class="ax-toolbar">
    <select id="ax-date" class="ax-select">
      <option value="">Today</option>
    </select>

    <input id="ax-q" class="ax-input" placeholder="Keywords"/>
    <input id="ax-kw" class="ax-input" style="min-width:200px" placeholder="Search title"/>

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

</div>




<script defer src="{{ '/assets/js/arxiv-app.js' | relative_url }}?v=1"></script>
