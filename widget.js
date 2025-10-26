// review-widget v1.3 — robust parsing + rotation + optional debug
(() => {
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  // Shadow DOM (fallback for very old browsers)
  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;

  // Read config from the loader <script>
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();
  const endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  const SHOW_MS = +(scriptEl?.getAttribute("data-show-ms") ?? 12000); // visible time
  const GAP_MS  = +(scriptEl?.getAttribute("data-gap-ms")  ?? 500);   // pause before next
  const DEBUG   = (scriptEl?.getAttribute("data-debug") || "0") === "1";
  const FADE_MS = 350;

  const log = (...a) => { if (DEBUG) console.log("[reviews-widget]", ...a); };

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Styles
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
    .stars { margin-top: 4px; font-size: 13px; opacity:.9 }
    .body  { padding: 0 12px 12px; font-size: 14px; line-height: 1.35; }
    .body.small { font-size: 12.5px; }
    .body.tiny  { font-size: 11.5px; }
    .brand { display:flex; align-items:center; justify-content: space-between; gap:8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.07); font-size:12px; opacity:.9; }
    .xbtn { appearance:none; border:0; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:0; opacity:.6; }
    .xbtn:hover { opacity:1; }

    .fade-in  { animation: fadeIn ${FADE_MS}ms ease forwards; }
    .fade-out { animation: fadeOut ${FADE_MS}ms ease forwards; }
    @keyframes fadeIn  { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
    @keyframes fadeOut { from { opacity:1; transform: translateY(0); } to { opacity:0; transform: translateY(8px); } }
  `;
  root.appendChild(style);

  // Container
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Helpers
  const mkStars = (n) => {
    const val = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return Array.from({ length: 5 }, (_, i) => (i < val ? "★" : "☆")).join(" ");
  };
  const scaleClass = (t = "") => {
    const len = (t || "").trim().length;
    if (len > 220) return "tiny";
    if (len > 140) return "small";
    return "";
  };
  const normalize = (data) => {
    // Accept many common shapes
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.reviews)) return data.reviews;
    if (data.reviews && Array.isArray(data.reviews.items)) return data.reviews.items;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.records)) return data.records;
    // Single-object fallback
    if (data.text || data.reviewText || data.content) return [data];
    return [];
  };

  function renderCard(r, businessName = "") {
    const card = document.createElement("div");
    card.className = "card fade-in";

    const header = document.createElement("div");
    header.className = "row";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.alt = "";
    avatar.src =
      r.profilePhotoUrl || r.photoUrl || r.avatarUrl ||
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.authorName || r.userName || r.author || r.name || "Anonymous";
    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = mkStars(r.rating || r.stars || r.score || 5);
    meta.appendChild(name);
    meta.appendChild(stars);

    const x = document.createElement("button");
    x.className = "xbtn";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";

    header.appendChild(avatar);
    header.appendChild(meta);
    header.appendChild(x);

    const body = document.createElement("div");
    body.className = "body " + scaleClass(r.text || r.reviewText || r.content || "");
    body.textContent = r.text || r.reviewText || r.content || "";

    const brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = `<span>Google Reviews</span><span>⭐️⭐️⭐️⭐️⭐️</span>`;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);

    x.addEventListener("click", () => {
      stop();
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(() => card.remove(), FADE_MS);
    });

    return card;
  }

  let reviews = [];
  let idx = 0;
  let timer = null;
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };

  function showNext() {
    if (!reviews.length) return;
    const r = reviews[idx % reviews.length];
    idx++;

    const card = renderCard(r);
    wrap.replaceChildren(card);
    log("show", idx, "/", reviews.length, r?.authorName || r?.name || "");

    stop();
    // after visible time, fade out and queue next
    timer = setTimeout(() => {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(() => {
        if (wrap.contains(card)) wrap.removeChild(card);
        timer = setTimeout(showNext, GAP_MS);
      }, FADE_MS);
    }, SHOW_MS);
  }

  // Fetch and start
  fetch(endpoint, { method: "GET", credentials: "omit", cache: "no-store" })
    .then(async res => {
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { parsed = { reviews: [{ text: raw, rating: 5 }] }; } // HTML fallback
      return parsed;
    })
    .then(data => {
      reviews = normalize(data);
      log("fetched reviews:", reviews.length);
      if (!reviews.length) throw new Error("No reviews returned");
      idx = 0;
      showNext();
    })
    .catch(err => {
      root.innerHTML =
        `<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">
           Widget error: ${String(err.message || err)}
         </div>`;
      console.error("[reviews-widget]", err);
    });
})();
