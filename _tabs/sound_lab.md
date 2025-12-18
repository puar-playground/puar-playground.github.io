---
title: Sound Lab
layout: page
permalink: /ab/
icon: fas fa-headphones
order: 3
---

<style>
.ab-wrap { display: grid; gap: 12px; }
.ab-card { border: 1px solid rgba(0,0,0,.15); border-radius: 12px; padding: 12px; }
.ab-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.small { font-size: 0.9em; opacity: 0.85; }
code { padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,.06); }
button { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.2); cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

<!-- ✅ JS 会在这里注入所有 UI -->
<div id="abRoot"></div>

<!-- ✅ 关键：用 defer，保证 DOM 在 JS 前就绪 -->
<script src="{{ '/assets/js/audio-lab.js' | relative_url }}" defer></script>

