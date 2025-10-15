(() => {
  if (customElements.get("life-ticker-bar")) return; // avoid redefining

  class LifeTickerBar extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      const label = this.getAttribute("text") ?? "life timestamp";
      // read ISO-8601 date string (e.g., 1992-12-23T05:00:00+08:00)
      const birthStr = this.getAttribute("birth");
      this._birth =
        birthStr ? Math.floor(new Date(birthStr).getTime() / 1000) : 0;

      root.innerHTML = `
        <style>
          :host {
            display: inline-flex;
            align-items: center;
            gap: var(--life-bar-gap, 8px);
            line-height: 1;
            color: inherit;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: var(--life-bar-font-size, 14px);
          }
          .label { opacity: .9; white-space: nowrap; }
          .heart {
            width: var(--life-bar-heart, 24px);
            height: var(--life-bar-heart, 24px);
            display: inline-block;
            transform-origin: center;
            animation: beat 1s ease-in-out infinite;
            filter: drop-shadow(0 0 6px #fec0ff);
          }
          @keyframes beat {
            0% { transform: scale(.95); }
            30% { transform: scale(1.08); }
            55% { transform: scale(1.00); }
            100% { transform: scale(.95); }
          }
          .ts {
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            // color: #ffcc33;
            // text-shadow: 0 0 8px rgba(255,204,51,0.7), 0 0 14px rgba(255,204,51,0.5);
          }
          svg { display:block }
          @media (prefers-reduced-motion: reduce) { .heart { animation: none; } }
        </style>
        <span class="label" part="label">${label}</span>
        <span aria-hidden="true">
          <svg class="heart" viewBox="0 0 24 24" role="img" focusable="false">
            <defs>
              <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="#fec0ff"/>
                <stop offset="100%" stop-color="#ff7891ff"/>
              </linearGradient>
            </defs>
            <path fill="url(#g)"
              d="M12 21s-6.716-3.94-9.293-7.07C1.02 12.01 1 9.5 3 7.5
                 4.95 5.55 7.88 5.64 9.9 7.66L12 9.76l2.1-2.1
                 c2.02-2.02 4.95-2.11 6.9-.16 2 2 1.98 4.51.293 6.43
                 C18.716 17.06 12 21 12 21z"/>
          </svg>
        </span>
        <span class="ts" id="ts" part="timestamp">…</span>
      `;
      this._tsEl = root.getElementById("ts");
    }

    connectedCallback() {
      const update = () => {
        const now = Math.floor(Date.now() / 1000);
        const lifeSeconds =
          this._birth > 0 ? now - this._birth : now;
        this._tsEl.textContent = lifeSeconds.toLocaleString();
      };
      update();
      const skew = 1000 - (Date.now() % 1000);
      this._align = setTimeout(() => {
        update();
        this._tick = setInterval(update, 1000);
      }, skew);
    }

    disconnectedCallback() {
      clearTimeout(this._align);
      clearInterval(this._tick);
    }
  }

  customElements.define("life-ticker-bar", LifeTickerBar);
})();