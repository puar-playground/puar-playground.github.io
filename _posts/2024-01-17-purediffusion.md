---
title: >-
    Repo: purediffusion
date: 2024-01-17 15:56:00 +500
categories: [Code, torch]
tags: [NN]
---
I created a repo, [`purediffusion`](https://github.com/puar-playground/purediffusion).  <br />
It is also available through pip:
```
pip install purediffusion
```
`purediffusion` is a torch implementation I used for DDPM with DDIM sampling. This implementation is not restricted for Image data. It is a convinient start to build a diffusion model for arbitrary data type. One can just design the network structure and data format, without coping with the coefficients in the diffusion schedule and the generation process.

