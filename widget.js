// review-widget v1.7 — avatars: robust key mapping + debug + fallback
(() => {
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();

  const endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  const SHOW_MS  = +(scriptEl?.getAttribute("data-show-ms") ?? 12000);
  const GAP_MS   = +(scriptEl?.getAttribute("data-gap-ms")  ?? 500);
  const FADE_MS  = 350;
  const DEBUG    = (scriptEl?.getAttribute("data-debug") || "0") === "1";
  const log      = (...a) => DEBUG && console.log("[reviews-widget v1.7]", ...a);

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset-inline-end: 16px; inset-block-end: 16px; z-index: 2147483000;
            font-family: "Assistant", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
    .card { width: 320px; max-width: 88vw; background: #ffffff; color: #0b1220; border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.06);
            overflow: hidden; direction: auto; }
    .row { display: grid; grid-template-columns: 40px 1fr 24px; gap: 10px; align-items: start; padding: 12px 12px 8px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background:#eee; display:block; }
    .avatar-fallback { display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; width:40px; height:40px; border-radius:50%; }
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

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // helpers
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
  const colorFromString = (s = "") => {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 70% 45%)`;
  };
  const firstLetter = (s = "") => (s.trim()[0] || "?").toUpperCase();

  // case-insensitive getter for image fields ("Photo", "profilePhotoUrl", etc.)
  const getPhotoUrl = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();
      if (lk === "photo" || lk === "profilephotourl" || lk === "profile_photo_url" ||
          lk === "photourl" || lk === "image" || lk === "imageurl" || lk === "avatar" || lk === "avatarurl") {
        const v = String(obj[k] ?? "").trim();
        if (v) return v;
      }
    }
    return "";
  };

  // normalize many JSON shapes → {authorName, text, rating, profilePhotoUrl}
  const normalize = (data) => {
    let arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data && typeof data === "object") {
      if (Array.isArray(data.reviews)) arr = data.reviews;
      else if (data.reviews && Array.isArray(data.reviews.items)) arr = data.reviews.items;
      else if (Array.isArray(data.items)) arr = data.items;
      else if (Array.isArray(data.data)) arr = data.data;
      else if (Array.isArray(data.results)) arr = data.results;
      else if (Array.isArray(data.records)) arr = data.records;
      else if (data.text || data.Content || data.reviewText || data.content) arr = [data];
    }
    return arr.map(x => ({
      authorName: x.authorName || x.userName || x.Header || x.name || x.author || "Anonymous",
      text:       x.text || x.reviewText || x.Content || x.content || "",
      rating:     x.rating || x.stars || x.score || 5,
      profilePhotoUrl: x.Photo || getPhotoUrl(x)
    }));
  };

  // avatar renderer with monogram fallback + explicit logs
  const renderMonogram = (name) => {
    const div = document.createElement("div");
    div.className = "avatar-fallback";
    div.textContent = firstLetter(name);
    div.style.background = colorFromString(name);
    return div;
  };

  const renderAvatar = (name, url) => {
    if (url) {
      log("avatar url:", url);
      const img = document.createElement("img");
      img.className = "avatar";
      img.alt = "";
      img.width = 40; img.height = 40;
      img.crossOrigin = "anonymous"; // harmless if not needed
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
      img.addEventListener("load", () => log("avatar ok"));
      img.addEventListener("error", () => {
        log("avatar error → fallback");
        img.replaceWith(renderMonogram(name));
      });
      return img;
    }
    log("avatar: no url → fallback");
    return renderMonogram(name);
  };

  function renderCard(r) {
    const card = document.createElement("div");
    card.className = "card fade-in";

    const header = document.createElement("div");
    header.className = "row";

    const avatarEl = renderAvatar(r.authorName, r.profilePhotoUrl || r.Photo);

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.authorName || "Anonymous";
    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = mkStars(r.rating);
    meta.appendChild(name);
    meta.appendChild(stars);

    const x = document.createElement("button");
    x.className = "xbtn";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";

    header.appendChild(avatarEl);
    header.appendChild(meta);
    header.appendChild(x);

    const body = document.createElement("div");
    body.className = "body " + scaleClass(r.text);
    body.textContent = r.text;

    const brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = `<span>Google Reviews</span><span>⭐️⭐️⭐️⭐️⭐️</span>`;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);

    x.addEventListener("click", () => {
      if (loop) { clearInterval(loop); loop = null; }
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(() => card.remove(), FADE_MS);
    });

    return card;
  }

  let reviews = [];
  let i = 0;
  let loop = null;

  const show = () => {
    if (!reviews.length) return;
    const card = renderCard(reviews[i % reviews.length]);
    i++;
    wrap.innerHTML = "";
    wrap.appendChild(card);
    setTimeout(() => {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
    }, Math.max(0, SHOW_MS - FADE_MS));
  };

  fetch(endpoint, { method: "GET", credentials: "omit", cache: "no-store" })
    .then(async res => {
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { parsed = { reviews: [{ text: raw }] }; }
      return parsed;
    })
    .then(data => {
      reviews = normalize(data);
      if (!reviews.length) throw new Error("No reviews returned");
      i = 0;
      show();
      if (loop) clearInterval(loop);
      loop = setInterval(show, SHOW_MS + GAP_MS);
    })
    .catch(err => {
      root.innerHTML =
        `<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">
           Widget error: ${String(err.message || err)}
         </div>`;
      console.error("[reviews-widget v1.7]", err);
    });
})();
