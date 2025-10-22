// review-widget v1.0.2 — white theme, tighter height, auto-fit text, 10s/5s timing
(() => {
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  // Shadow DOM
  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;

  // ── Config: allow data-endpoint override, else build from data-slug
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();
  const explicitEndpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  const slug = scriptEl && scriptEl.getAttribute("data-slug");

  if (!explicitEndpoint && !slug) {
    root.innerHTML = '<div style="font-family: system-ui; color:#c00">Missing data-endpoint or data-slug on &lt;script&gt; tag.</div>';
    return;
  }

  const endpoint = explicitEndpoint ||
    ('https://hook.eu2.make.com/aasl5df1y3qaxkbx9tp57miq9wcpnw8c?slug=' + encodeURIComponent(slug));

  const DEBUG = new URLSearchParams(location.search).get('rw_debug') === '1';

  // ── Base HTML (white theme + tighter layout)
  root.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');
      :host{all:initial}*,*:before,*:after{box-sizing:border-box}
      .rw-wrap{position:fixed;right:24px;bottom:24px;z-index:2147483647;font-family:"Assistant",ui-sans-serif,system-ui;direction:rtl}
      .rw-list{display:flex;flex-direction:column;gap:12px}
      .rw-card{
        position:relative;--rw-w:min(92vw,360px);--rw-h:120px;
        width:var(--rw-w);height:var(--rw-h);
        background:#ffffff;color:#111827;border-radius:14px;
        display:flex;gap:10px;padding:12px 14px;
        box-shadow:0 10px 24px rgba(0,0,0,.12), 0 1px 0 rgba(0,0,0,.06);
        overflow:hidden;opacity:0;transform:translate(14px) scale(.98);
        animation:rw-enter .35s cubic-bezier(.22,1,.36,1) forwards
      }
      .rw-card.rw-exiting{animation:rw-exit .24s cubic-bezier(.4,0,.2,1) forwards}
      .rw-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:0 0 40px;margin-top:2px;background:#e2e8f0}
      .rw-body{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center}
      .rw-header{font-weight:700;font-size:15px;margin:0 0 2px;color:#111111;display:flex;align-items:center;gap:8px}
      .rw-stars{display:inline-flex;gap:2px;transform:translateY(-1px)}
      .rw-stars svg{width:14px;height:14px;display:block;fill:#fbbf24}
      .rw-text{
        flex:1;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;
        line-height:1.4;color:#333333;white-space:normal;font-size:15px;
        transition:font-size .25s ease, -webkit-line-clamp .25s ease
      }
      .rw-footer{display:flex;align-items:center;gap:8px;margin-top:4px;opacity:.95}
      .rw-google{width:16px;height:16px;opacity:.95}
      .rw-close{
        position:absolute;top:8px;left:8px;width:28px;height:28px;border:0;border-radius:8px;
        background:#eef2f7;color:#334155;display:grid;place-items:center;line-height:1;font-size:16px;font-weight:700;cursor:pointer;opacity:.9;
        transition:opacity .15s,transform .15s,background .15s
      }
      .rw-close:hover{opacity:1;transform:scale(1.05);background:#e2e8f0}
      @keyframes rw-enter{from{opacity:0;transform:translate(14px) scale(.98)}to{opacity:1;transform:translate(0) scale(1)}}
      @keyframes rw-exit{from{opacity:1;transform:translate(0) scale(1)}to{opacity:0;transform:translate(-14px) scale(.98)}}
    </style>
    <div class="rw-wrap"><div class="rw-list" id="list"></div></div>
  `;

  const list = root.getElementById("list"); // ← declared ONCE here
  const starSvg = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L10 15.6l-5.4 2.9 1-6.1L1.2 7.9l6.1-.9L10 1.5z"/></svg>';

  // ── Normalizer
  const NAME_RE  = /(?:^|_|\b)(name|author|author_name|username|display[_ ]?name|title|Header|שם|מאת|כותב)(?:$|\b)/i;
  const TEXT_RE  = /(?:^|_|\b)(text|comment|message|body|review|content|description|snippet|Content|ביקורת|תוכן|חוות[_ ]?דעת)(?:$|\b)/i;
  const RATE_RE  = /(?:^|_|\b)(rating|stars|score|rate|ratingValue|starRating|value|דירוג|כוכבים)(?:$|\b)/i;
  const PHOTO_RE = /(?:^|_|\b)(photoUrl|avatar|image|avatar_url|photo|profile_photo_url|Photo|reviewerPhotoUrl|תמונה)(?:$|\b)/i;

  function stripTags(s){ return String(s).replace(/<[^>]*>/g,'').trim(); }

  function deepFind(obj, keyRegex, maxDepth=5){
    const seen = new Set();
    function walk(x, d){
      if (!x || typeof x!=='object' || d>maxDepth || seen.has(x)) return undefined;
      seen.add(x);
      for (const k of Object.keys(x)){
        const v = x[k];
        if (keyRegex.test(k) && v!=null && String(v).trim()!=="") return v;
        if (v && typeof v === 'object'){
          const r = walk(v, d+1);
          if (r !== undefined) return r;
        }
      }
      return undefined;
    }
    return walk(obj,0);
  }

  function firstNonEmpty(){ for (let i=0;i<arguments.length;i++){ const v=arguments[i]; if (v!=null && String(v).trim()!=="") return String(v); } return ""; }

  function normalizeReview(r = {}) {
    const src = r.review || r.node || r.item || r.data || r;
    const authorContainer = src.user || src.author || src.reviewer || src.owner || src.profile || {};

    const author = firstNonEmpty(
      src.Header,
      deepFind(src, NAME_RE),
      deepFind(authorContainer, NAME_RE),
      src.author_name, src.authorName, src.userName,
      authorContainer.display_name, authorContainer.name,
      src.profile && (src.profile.displayName || src.profile.name),
      src.title, src.name,
      "לקוח"
    );

    const rawText = firstNonEmpty(
      src.Content,
      deepFind(src, TEXT_RE), src.text, src.comment, src.review, src.content, src.description, src.snippet, ""
    );

    const rawRating = firstNonEmpty(
      deepFind(src, RATE_RE), src.rating, src.stars, src.score, src.rate, 5
    );

    const photoUrl = firstNonEmpty(
      src.Photo, src.reviewerPhotoUrl,
      deepFind(src, PHOTO_RE), deepFind(authorContainer, PHOTO_RE), ""
    );

    const ratingNum = Math.max(0, Math.min(5, Math.round(Number(rawRating) || 5)));

    return { author: stripTags(author) || "לקוח", text: stripTags(rawText), rating: ratingNum, photoUrl: String(photoUrl || "") };
  }

  function normalizeArray(payload) {
    let arr = [];
    if (Array.isArray(payload)) arr = payload;
    else if (Array.isArray(payload && payload.reviews)) arr = payload.reviews;
    else if (Array.isArray(payload && payload.data)) arr = payload.data;
    else if (Array.isArray(payload && payload.items)) arr = payload.items;
    else if (payload && typeof payload === "object") arr = [payload];

    arr = arr.map(normalizeReview).filter(x => (x.text || x.author));
    return arr.length ? arr : [{ author: "Amit", text: "Great service and smooth experience. Will use again!", rating: 5 }];
  }

  // ── Google icon
  const googleSvg =
    '<svg class="rw-google" viewBox="0 0 48 48" aria-hidden="true">'+
    '<path d="M43.6 20.5H42V20H24v8h11.3A12.9 12.9 0 1 1 24 11a12.7 12.7 0 0 1 8.8 3.5l5.7-5.7A21 21 0 1 0 45 24c0-1.2-.1-2.1-.4-3.5z" fill="#FFC107"/>'+
    '<path d="M6.3 14.7l6.6 4.8A12.7 12.7 0 0 1 24 11c3.6 0 6.9 1.5 9.2 3.9l5.8-5.8A21 21 0 0 0 6.3 14.7z" fill="#FF3D00"/>'+
    '<path d="M24 45c5.4 0 10.3-2.1 13.9-5.6l-6.4-5.3A12.7 12.7 0  0 1 24 36a12.9 12.9 0 0 1-12.3-9l-6.5 5A21 21 0  0 0 24 45z" fill="#4CAF50"/>'+
    '<path d="M43.6 20.5H42V20H24v8h11.3C34.8 32.1 29.9 36 24 36v9c8.6 0 16-6 18.4-14.5 0 0 1.2-4.3 1.2-10z" fill="#1976D2"/>'+
    '</svg>';

  // ── Dynamic sizing
  function initialSizeByWords(text){
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    let fontPx = 15, clamp = 3, h = 120;
    if (words > 25) { fontPx = 12; clamp = 5; h = 160; }
    else if (words > 15) { fontPx = 13; clamp = 4; h = 140; }
    return { fontPx, clamp, h };
  }

  function autoFitCard(card){
    const content = card.querySelector('.rw-text');
    if (!content) return;

    const toNum = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
    let fontSize = toNum(content.style.fontSize || 15, 15);
    let clamp = parseInt(content.style.webkitLineClamp || 3, 10);
    const baseH = 120;

    const setHeights = () => {
      const extraLines = Math.max(0, clamp - 3);
      const newH = baseH + (extraLines * 18);
      card.style.setProperty("--rw-h", newH + "px");
    };

    setHeights();
    let guard = 16;
    const fits = () => content.scrollHeight <= content.clientHeight + 0.5;

    requestAnimationFrame(() => {
      while (!fits() && guard-- > 0) {
        if (fontSize > 11) { fontSize -= 1; content.style.fontSize = fontSize + "px"; }
        else if (clamp < 6) { clamp += 1; content.style.webkitLineClamp = String(clamp); setHeights(); }
        else { break; }
      }
    });
  }

  // ── Timing
  const DISPLAY_MS = 10000;
  const GAP_MS = 5000;

  // ── Card UI
  function makeCard(review){
    const {author="לקוח", text="", rating=5, photoUrl} = review || {};

    const card = document.createElement("div");
    card.className = "rw-card";

    const avatar = document.createElement("img");
    avatar.className = "rw-avatar";
    avatar.src = photoUrl || "https://www.gravatar.com/avatar/?d=mp&s=80";
    avatar.alt = "";

    const body = document.createElement("div");
    body.className = "rw-body";

    const header = document.createElement("div");
    header.className = "rw-header";
    header.textContent = author;

    const content = document.createElement("div");
    content.className = "rw-text";
    content.textContent = text;

    const s = initialSizeByWords(text);
    content.style.fontSize = s.fontPx + "px";
    content.style.webkitLineClamp = String(s.clamp);
    card.style.setProperty("--rw-h", s.h + "px");

    const footer = document.createElement("div");
    footer.className = "rw-footer";
    const starCount = Math.max(0, Math.min(5, Math.round(rating || 5)));
    const starsHtml = new Array(starCount).fill(0).map(() => starSvg).join("");
    footer.innerHTML = googleSvg + '<div class="rw-stars">' + starsHtml + '</div>';

    const closeBtn = document.createElement("button");
    closeBtn.className = "rw-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.onclick = () => exitCard(card);

    body.appendChild(header);
    body.appendChild(content);
    body.appendChild(footer);

    card.appendChild(closeBtn);
    card.appendChild(avatar);
    card.appendChild(body);

    return card;
  }

  function exitCard(card){
    if (!card || card.classList.contains("rw-exiting")) return;
    card.classList.add("rw-exiting");
    setTimeout(() => card.remove(), 260);
  }

  // ── Rotation
  let reviews = [], idx = 0, showing = null, timers = [];
  function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
  function showNext(){
    clearTimers(); if(!reviews.length) return;
    const review = reviews[idx % reviews.length]; idx++;
    if (showing) exitCard(showing);
    const card = makeCard(review);
    list.appendChild(card);
    autoFitCard(card);
    showing = card;

    timers.push(setTimeout(() => {
      exitCard(card);
      timers.push(setTimeout(showNext, GAP_MS));
    }, DISPLAY_MS));
  }

  // ── Fetch reviews
  fetch(endpoint, { headers: { "Accept":"application/json" } })
    .then(r => r.json())
    .then(json => {
      if (DEBUG) console.log("[RW] raw response:", json);
      reviews = normalizeArray(json);
      if (DEBUG) console.log("[RW] normalized:", reviews);
      showNext();
    })
    .catch(err => {
      if (DEBUG) console.warn("[RW] fetch failed:", err);
      reviews = normalizeArray(null);
      showNext();
    });

})();
