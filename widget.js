// /public/widget.js
(() => {
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  // Shadow DOM to isolate styles from site CSS
  const root = hostEl.attachShadow({ mode: "open" });

  // Read endpoint from data attribute
  // Read slug from data attribute and build endpoint URL automatically
const scriptEl = document.currentScript || Array.from(document.scripts).pop();
const slug = scriptEl.getAttribute("data-slug");

if (!slug) {
  root.innerHTML = `<div style="font-family: system-ui; color:#c00">Missing data-slug on <script> tag.</div>`;
  return;
}

const endpoint = `https://hook.eu2.make.com/aasl5df1y3qaxkbx9tp57miq9wcpnw8c?slug=${encodeURIComponent(slug)}`;

  // Base HTML skeleton
  root.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');

      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }

      .rw-wrap {
        position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
        font-family: "Assistant", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans";
        direction: rtl; /* RTL-safe */
      }
      .rw-list { display: flex; flex-direction: column; gap: 12px; }

      .rw-card{
        position: relative;
        --rw-w: min(92vw, 360px);
        --rw-h: 140px;
        width: var(--rw-w);
        height: var(--rw-h);
        background: #0f172a; color: #e5e7eb;
        border-radius: 14px;
        display: flex; gap: 12px; padding: 14px 16px;
        box-shadow: 0 10px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.02);
        overflow: hidden; opacity: 0; transform: translate(14px) scale(.98);
        pointer-events: auto;
        animation: rw-enter .35s cubic-bezier(.22,1,.36,1) forwards;
      }
      .rw-card.rw-exiting { animation: rw-exit .24s cubic-bezier(.4,0,.2,1) forwards; }

      .rw-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex: 0 0 42px; margin-top: 2px; background: #0ea5e9; }

      /* Vertically center the content column */
      .rw-body { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }

      .rw-header { font-weight: 700; font-size: 15px; margin-bottom: 4px; color: #f3f4f6; display:flex; align-items:center; gap:8px; }
      .rw-stars { display:inline-flex; gap: 2px; transform: translateY(-1px); }
      .rw-stars svg{ width:14px; height:14px; display:block; fill: #fbbf24; }

      /* Dynamic text sizing: clamp base size, then JS will nudge smaller for very long text */
      .rw-text{
        flex: 1; overflow: hidden;
        display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;
        line-height: 1.45; color: #d1d5db; white-space: normal;
        font-size: clamp(13px, 1.7vw, 15px);
      }

      .rw-footer{ display: flex; align-items: center; gap: 8px; margin-top: 6px; opacity: .9; }
      .rw-google { width: 16px; height: 16px; flex: 0 0 16px; opacity:.95; }

      /* Close button (X) */
      .rw-close{
        position:absolute; top:8px; left:8px; /* left for RTL; switch to right if LTR */
        width:28px; height:28px; border:0; border-radius:8px;
        background:#172033; color:#cbd5e1; display:grid; place-items:center;
        line-height:1; font-size:16px; font-weight:700; cursor:pointer;
        opacity:.85; transition:opacity .15s, transform .15s, background .15s;
      }
      .rw-close:hover{ opacity:1; transform:scale(1.05); background:#1e2a44; }

      @keyframes rw-enter { from { opacity:0; transform: translate(14px) scale(.98) } to { opacity:1; transform: translate(0) scale(1) } }
      @keyframes rw-exit { from { opacity:1; transform: translate(0) scale(1) } to { opacity:0; transform: translate(-14px) scale(.98) } }
    </style>

    <div class="rw-wrap">
      <div class="rw-list" id="list"></div>
    </div>
  `;

  const list = root.getElementById("list");

  // Utilities
  const starSvg = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L10 15.6l-5.4 2.9 1-6.1L1.2 7.9l6.1-.9L10 1.5z"/></svg>`;

  function makeCard(review) {
    const { author = "לקוח", text = "", rating = 5, photoUrl } = review || {};
    // Build DOM
    const card = document.createElement("div");
    card.className = "rw-card";

    // Avatar
    const avatar = document.createElement("img");
    avatar.className = "rw-avatar";
    avatar.src = photoUrl || "https://www.gravatar.com/avatar/?d=mp&s=80";
    avatar.alt = "";

    // Body
    const body = document.createElement("div");
    body.className = "rw-body";

    const header = document.createElement("div");
    header.className = "rw-header";
    header.textContent = author;

    const stars = document.createElement("div");
    stars.className = "rw-stars";
    const starCount = Math.max(0, Math.min(5, Math.round(rating || 5)));
    stars.innerHTML = new Array(starCount).fill(0).map(() => starSvg).join("");

    header.appendChild(stars);

    const content = document.createElement("div");
    content.className = "rw-text";
    content.textContent = text;

    const footer = document.createElement("div");
    footer.className = "rw-footer";
    footer.innerHTML = `
      <img class="rw-google" alt="Google" src="https://www.gstatic.com/images/branding/product/2x/google_g_48dp.png">
      <span>ביקורת מגוגל</span>
    `;

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "rw-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => exitCard(card));

    body.appendChild(header);
    body.appendChild(content);
    body.appendChild(footer);

    card.appendChild(closeBtn);
    card.appendChild(avatar);
    card.appendChild(body);

    // Dynamic downscaling for very long text (keeps container size stable)
    const len = (text || "").length;
    if (len > 220) {
      card.style.setProperty("--rw-h", "156px");
      content.style.fontSize = "13px";
    }
    if (len > 360) {
      content.style.fontSize = "12px";
      card.style.setProperty("--rw-h", "164px");
    }
    return card;
  }

  function exitCard(card) {
    if (!card || card.classList.contains("rw-exiting")) return;
    card.classList.add("rw-exiting");
    setTimeout(() => card.remove(), 260);
  }

  // Rotation: show 5s, exit, 3s gap, next
  let reviews = [];
  let idx = 0;
  let showing = null;
  let timers = [];

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function showNext() {
    clearTimers();
    if (!reviews.length) return;

    const review = reviews[idx % reviews.length];
    idx++;

    // Remove any current card
    if (showing) exitCard(showing);

    // Add new card
    const card = makeCard(review);
    list.appendChild(card);
    showing = card;

    // Schedule exit after 5s, then wait 3s and show next
    timers.push(setTimeout(() => {
      exitCard(card);
      timers.push(setTimeout(showNext, 3000));
    }, 5000));
  }

  // Fetch reviews from Make (or fallback)
  fetch(endpoint, { headers: { "Accept": "application/json" } })
    .then(r => r.json())
    .then(json => {
      const arr = Array.isArray(json?.reviews) ? json.reviews : [];
      reviews = arr.length ? arr : [{
        author: "Shir",
        text: "חוויה מצוינת! שירות מהיר ומקצועי. ממליצה בחום.",
        rating: 5
      }];
      showNext();
    })
    .catch(() => {
      reviews = [{
        author: "Amit",
        text: "Great service and smooth experience. Will use again!",
        rating: 5
      }];
      showNext();
    });

})();
