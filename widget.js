// /public/widget.js
// review-widget v1.0.x — stable MVP that worked on client sites.
// Expects a full JSON endpoint passed via data-endpoint on the script tag.

(() => {
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  // Shadow DOM (fallback to host for very old browsers)
  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;

  // Read endpoint from the current <script> tag (the one that included this file)
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();
  const endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Basic styles injected into shadow root
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset-inline-end: 16px; inset-block-end: 16px; z-index: 2147483000;
            font-family: "Assistant", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
    .card { width: 320px; max-width: 88vw; background: #ffffff; color: #0b1220; border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.06);
            overflow: hidden; direction: auto; }
    .row { display: grid; grid-template-columns: 40px 1fr 24px; gap: 10px; align-items: start; padding: 12px 12px 8px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background:#eee; }
    .meta { display:flex; flex-direction:column; gap:4px; }
    .name { font-weight: 700; font-size: 14px; line-height: 1.2; }
    .stars { display:flex; align-items:center; gap:2px; font-size: 14px; }
    .body  { padding: 0 12px 12px; font-size: 14px; line-height: 1.35; }
    .body.small { font-size: 12.5px; }
    .body.tiny  { font-size: 11.5px; }
    .brand { display:flex; align-items:center; justify-content: space-between; gap:8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.07); }
    .gmark { display:flex; align-items:center; gap:6px; opacity:.9; font-size:12px; }
    .xbtn { appearance:none; border:0; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:0; opacity:.6; }
    .xbtn:hover { opacity:1; }
    .fade-in  { animation: fadeIn .35s ease forwards; }
    .fade-out { animation: fadeOut .35s ease forwards; }
    @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
    @keyframes fadeOut { from { opacity:1; transform: translateY(0); } to { opacity:0; transform: translateY(8px); } }
  `;
  root.appendChild(style);

  // Container
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Helpers
  const mkStars = (n) => {
    const out = [];
    const val = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    for (let i = 0; i < 5; i++) out.push(i < val ? "★" : "☆");
    return out.join(" ");
  };

  const scaleClass = (t = "") => {
    const len = (t || "").trim().length;
    if (len > 220) return "tiny";
    if (len > 140) return "small";
    return "";
  };

  // Render one review card
  function renderCard(r) {
    const card = document.createElement("div");
    card.className = "card fade-in";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.alt = "";
    avatar.src = r.profilePhotoUrl || r.photoUrl || r.avatarUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.authorName || r.userName || "Anonymous";

    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = mkStars(r.rating);

    const x = document.createElement("button");
    x.className = "xbtn";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.addEventListener("click", () => {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(() => card.remove(), 280);
      // stop rotation on manual close
      if (rotateTimer) clearTimeout(rotateTimer);
    });

    const header = document.createElement("div");
    header.className = "row";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.appendChild(name);
    meta.appendChild(stars);
    header.appendChild(avatar);
    header.appendChild(meta);
    header.appendChild(x);

    const body = document.createElement("div");
    body.className = "body " + scaleClass(r.text || r.content);
    body.textContent = r.text || r.content || "";

    const brand = document.createElement("div");
    brand.className = "brand";
    const gmark = document.createElement("div");
    gmark.className = "gmark";
    gmark.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.23 1.26-.93 2.33-1.98 3.04v2.52h3.2c1.87-1.72 2.95-4.25 2.95-7.27 0-.7-.06-1.37-.17-2.01z"/><path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36l-3.2-2.52c-.89.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56A9.818 9.818 0 0 0 12.18 22z"/><path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82V7.64H3.4a9.82 9.82 0 0 0 0 8.72l3.29-2.34z"/><path fill="#EA4335" d="M12.18 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12.18 2c-3.78 0-7.01 2.17-8.78 5.64l3.29 2.56c.77-2.32 2.93-4.7 5.49-4.7z"/></svg><span>Google Reviews</span>';

    const bName = document.createElement("div");
    bName.style.fontSize = "12px";
    bName.style.opacity = "0.8";
    bName.textContent = businessName || "";

    brand.appendChild(gmark);
    brand.appendChild(bName);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);
    return card;
  }

  let businessName = "";
  let reviews = [];
  let idx = 0;
  let rotateTimer = null;

  function showNext() {
    if (!reviews.length) return;
    const r = reviews[idx % reviews.length];
    idx++;

    const card = renderCard(r);
    wrap.replaceChildren(card);

    // auto-rotate: card visible ~5s, gap ~3s
    if (rotateTimer) clearTimeout(rotateTimer);
    rotateTimer = setTimeout(() => {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(() => {
        if (wrap.contains(card)) wrap.removeChild(card);
        rotateTimer = setTimeout(showNext, 300); // gap 0.3s before next fade-in
      }, 280);
    }, 5000);
  }

  // Container after functions to ensure it exists before first render
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Fetch reviews JSON from your proxy API (Make behind the scenes)
  fetch(endpoint, { headers: { "Content-Type": "application/json" }, cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      // normalize shape
      businessName = data.businessName || data.placeName || "";
      reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length && Array.isArray(data.items)) reviews = data.items;

      if (!reviews.length) throw new Error("No reviews returned");
      showNext();
    })
    .catch(err => {
      root.innerHTML =
        `<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">
           Widget error: ${String(err.message || err)}
         </div>`;
    });
})();
