---
# the default layout is 'page'
title: About Me
icon: fas fa-user
order: 1
---
<!-- Include Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

<!-- Include life-ticker-bar component -->
<script type="module" src="{{ '/assets/js/life-ticker-bar.js' | relative_url }}"></script>

## Jian Chen

I am a Senior AI Researcher at Dolby Laboratories (Sound Experience Lab). My work sits at the intersection of audio, language, and vision — audio foundation models, multimodal large language models, and agentic systems — spanning multimodal generation and reasoning, post-training, and model efficiency. I also collaborate actively with academic partners on multimodal-LLM applications.

>[<i class="fas fa-address-card"></i>]({{ site.url }}/download/Jian_Chen_CV_en.pdf) CV in PDF · [<i class="fas fa-envelope"></i>](mailto:jian.chen@dolby.com) jian.chen@dolby.com · [<i class="fas fa-user-graduate"></i>](https://scholar.google.com/citations?user=uBGjz-EAAAAJ) Google Scholar · [<i class="fab fa-github"></i>](https://github.com/puar-playground) GitHub

## Research

### Speech & Audio AI — *2025 – present*

At Dolby Laboratories, my work centers on audio AI — audio foundation models and the agentic systems around them. The research directions closest to my heart include **audio agentic systems**: LLM-based assistants that interpret natural-language prompts and audio inputs, then orchestrate modular audio skills — source separation, spatial layout, trajectory design — for controllable, object-based spatial audio creation and editing; and **efficient voice cloning**: transcript-free, non-autoregressive approaches that combine masked generation with accelerated flow-matching rendering to deliver large end-to-end speedups with competitive speaker similarity and intelligibility across English and Chinese. I am also working on **full-duplex speech-to-speech models** for natural, real-time spoken dialogue.

### Efficient LLMs & Compression — *2025 – present*

This is a collaboration with friends outside of work: together we have been making LLMs cheaper to serve. Swift-SVD (ICML 2026) extends low-rank KV-cache compression with dynamic rank allocation across layers and shows that incremental-SVD is numerically more stable than classical SVD-based approaches, improving QA and perplexity under compression; KV-Core (NeurIPS 2025 Workshop) provides the data-aware benchmarking and the simple, theoretically optimal core method behind it.

### Multimodal LLMs & Document Understanding — *2024 – 2025*

A long-standing thread of mine is helping multimodal LLMs truly read. At Adobe I built SV-RAG (ICLR 2025), a framework that lets a 4B multimodal backbone achieve multi-page document understanding competitive with much larger proprietary models, and created VisR-Bench and MMR, benchmarks that exposed systematic weaknesses in structured table reasoning and low-resource languages. I have also contributed to LLaVA-Read and the LaRA/TRINS document-reading models, and explored cross-modal alignment between symbolic music and language with MusiXQA.

### Spatial Planning — *2024*

In this area I work on layout generation and planning: LACE (ICLR 2024), a continuous diffusion model that uses constrained optimization to unify multiple conditional inputs for layout generation and editing, and TextLap (EMNLP 2024), which customizes language models for text-to-layout planning and reached state-of-the-art on graphical design benchmarks.

## Education
- [Ph.D.](https://puar-playground.github.io/posts/defense_passed/) in Computer Science, University at Buffalo, *2018 Fall – 2025 Spring*
- M.S. in Electrical Engineering, Drexel University, *2015 Fall – 2017 Spring*
- B.S. in Applied Mathematics, Hunan University, *2011 Fall – 2015 Spring*

## Experience [<i class="fab fa-linkedin"></i>](https://www.linkedin.com/in/jian-chen-1a0b9a11b/)
- Dolby Laboratories, Sound Experience Lab — Senior AI Researcher, *06/2025 – present*
- Adobe, Document Intelligence Lab — Research Scientist Intern, *05/2024 – 11/2024*
- MBZUAI — Research Assistant, *10/2023 – 02/2024*
- University at Buffalo — Research Assistant, *09/2018 – 09/2025*

## Professional Service
I review for the major AI venues — NeurIPS, ICLR ([Notable Reviewer](https://iclr.cc/Conferences/2025/Reviewers) 2025), ICML, AAAI, ACL, ICCV, CVPR, TMLR, IJCAI, ARR — as well as journals such as [Genome Biology](https://puar-playground.github.io/download/Reviewer_Certificate_02_November_2025.pdf) and TETCI.

## Beyond Research

### Tennis 🎾
After moving to Atlanta in 2025 I picked up tennis again, and it has grown into a serious pursuit: I take lessons, practice regularly, and work hard in matches with the goal of steadily raising my [UTR](https://app.utrsports.net/profiles/5990914) (Universal Tennis Rating).

### Music 🎸
Music has been with me since long before research: I play guitar and arrange music as a hobby, and I share my work on [YouTube](https://www.youtube.com/@jianchen2550). In 2025 I completed Berklee Online's songwriting certificate — writing music for the pure joy of it.

<div style="text-align: right;">
  <life-ticker-bar
    birth="1992-12-23T05:00:00+08:00"
    text="life timestamp">
  </life-ticker-bar>
</div>
