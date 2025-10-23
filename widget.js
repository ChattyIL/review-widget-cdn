(() => {
  // 1) find host
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  // 2) shadow DOM (isolates styles)
  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;

  // 3) read data-endpoint from the <script> tag that loaded this file
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();
  const endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // 4) simple styles (clean and safe)
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset-inline-end: 16px; inset-block-end: 16px; z-index: 2147483000;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
    .card { width: 320px; max-width: 88vw; background: #ffffff; color: #0b1220; border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); border: 1px solid rgba(0,0,0,0.06);
            overflow: hidden; direction: auto; }
    .row { display: grid; grid-template-columns: 40px 1fr 24px; gap: 10px; align-items: start; padding: 12px 12px 8px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background:#eee; }
    .name { font-weight: 700; font-size: 14px; line-height: 1.2; }
    .stars { margin-top: 4px; font-size: 13px; opacity:.9 }
    .body  { padding: 0 12px 12px; font-size: 14px; line-height: 1.35; }
    .body.small { font-size: 12.5px; }
    .body.tiny  { font-size: 11.5px; }
    .brand { display:flex; align-items:center; justify-content: space-between; gap:8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.07); font-size:12px; opacity:.9; }
    .fade-in  { animation: fadeIn .35s ease forwards; }
    @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
  `;
  root.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // helpers
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

  // ---- render one review card (you don't need to find this; it's here) ----
  function renderCard(r) {
    const DEFAULT_AVATAR =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    // map your Make fields:
    // Header -> name, Content -> text, Photo -> avatar
    const nameValue =
      r.Header || r.authorName || r.userName || r.author || r.name || "Anonymous";

    const rawText = r.Content ?? r.text ?? r.reviewText ?? r.content ?? "";
    const textValue =
      typeof rawText === "string" && /^https?:\/\//i.test(rawText) ? "" : (rawText || "");

    const ratingValue = Math.round(Number(r.rating ?? r.stars ?? r.score ?? r.br100 ?? 5));

    const avatarValue =
      r.Photo || r.reviewerPhotoUrl || r.profilePhotoUrl || r.photoUrl || r.avatarUrl || DEFAULT_AVATAR;

    const card = document.createElement("div");
    card.className = "card fade-in";

    const header = document.createElement("div");
    header.className = "row";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.alt = "";
    avatar.src = avatarValue;

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = nameValue;

    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = mkStars(ratingValue);

    meta.appendChild(name);
    meta.appendChild(stars);

    header.appendChild(avatar);
    header.appendChild(meta);
    header.appendChild(document.createElement("div")); // spacer for grid

    const body = document.createElement("div");
    body.className = "body " + scaleClass(textValue);
    body.textContent = textValue;

    const brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = `<span>Google Reviews</span><span>⭐️⭐️⭐️⭐️⭐️</span>`;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);
    wrap.textContent = ""; // show only one at a time
    wrap.appendChild(card);
  }

  // fallback if endpoint returns ready-made HTML (not JSON)
  function renderHtml(html) {
    const card = document.createElement("div");
    card.className = "card fade-in";
    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = html; // trust your Make response
    card.appendChild(body);
    wrap.textContent = "";
    wrap.appendChild(card);
  }

  // ---- load the data (this is the load() you asked about) ----
  async function load() {
    try {
      const res = await fetch(endpoint, { method: "GET", credentials: "omit" });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const raw = await res.text();

      if (!res.ok) {
        console.error("[reviews-widget] HTTP", res.status, raw);
        renderHtml('<span style="color:#c00">Failed to load reviews.</span>');
        return;
      }

      // treat as JSON even if content-type is text/plain
      const looksJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
      if (ct.includes("application/json") || looksJson) {
        try {
          const json = JSON.parse(raw);
          const list = Array.isArray(json) ? json : (json.reviews || []);
          if (!list.length) {
            renderHtml("<em>No reviews yet.</em>");
            return;
          }
          renderCard(list[0]); // show the first review
          return;
        } catch (e) {
          console.warn("[reviews-widget] JSON parse failed, will render as HTML:", e);
        }
      }

      // if not JSON, treat it as HTML snippet
      renderHtml(raw);
    } catch (err) {
      console.error("[reviews-widget] error:", err);
      renderHtml('<span style="color:#c00">Error loading reviews.</span>');
    }
  }

  requestAnimationFrame(load);
})();
