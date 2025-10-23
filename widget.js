(() => {
  // ===== config (timings) =====
  const DISPLAY_MS = 12000; // show each review for 12s
  const BREAK_MS   = 8000;  // 8s break between reviews
  const EXIT_MS    = 550;   // exit animation length (ms)

  // ===== host / shadow root =====
  const hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;
  const root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;

  // read endpoint from script tag
  const scriptEl = document.currentScript || Array.from(document.scripts).pop();
  const endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // ===== styles =====
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap {
      position: fixed;
      right: 16px; bottom: 16px; /* always right side */
      z-index: 2147483000;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    }
    .card {
      width: 320px; max-width: 88vw;
      background: #ffffff; color: #0b1220;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      border: 1px solid rgba(0,0,0,0.06);
      overflow: hidden; direction: auto;
      will-change: transform, opacity;
    }
    .row { display: grid; grid-template-columns: 40px 1fr 24px; gap: 10px; align-items: start; padding: 12px 12px 8px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background:#eee; }
    .name { font-weight: 700; font-size: 14px; line-height: 1.2; }
    .body { padding: 0 12px 12px; font-size: 14px; line-height: 1.35; white-space: pre-wrap; }
    .body.small { font-size: 12.5px; }
    .body.tiny  { font-size: 11.5px; }
    .brand {
      display:flex; align-items:center; justify-content: space-between; gap:8px;
      padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.07); font-size:12px; opacity:.95;
    }
    .brand-left { display:flex; align-items:center; gap:8px }
    .glogo { width:16px; height:16px; border-radius:3px }
    .stars { letter-spacing: 1px; color: #d4af37; } /* richer gold */
    /* animations */
    .enter { animation: popIn .45s cubic-bezier(.18,.89,.32,1.28) forwards; }
    .exit  { animation: fadeOutDown .55s ease forwards; }
    @keyframes popIn {
      0% { opacity:0; transform: translateY(12px) scale(.98) }
      100%{ opacity:1; transform: translateY(0) scale(1) }
    }
    @keyframes fadeOutDown {
      0% { opacity:1; transform: translateY(0) }
      100%{ opacity:0; transform: translateY(12px) }
    }
  `;
  root.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // ===== helpers =====
  const clamp = (s, max) => (s || "").slice(0, max);
  const safeText = (x, max = 1000) => clamp(String(x ?? ""), max).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const scaleClass = (t = "") => {
    const len = (t || "").trim().length;
    if (len > 220) return "tiny";
    if (len > 140) return "small";
    return "";
  };

  const mkStars = (n) => {
    const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return "★★★★★".slice(0, full).padEnd(5, "☆");
  };

  // normalize review object to our fields
  const normalize = (r) => ({
    name:  safeText(r.Header || r.authorName || r.userName || r.author || r.name || "Anonymous", 80),
    text:  safeText((r.Content ?? r.text ?? r.reviewText ?? r.content ?? ""), 1200),
    photo: (r.Photo || r.reviewerPhotoUrl || r.profilePhotoUrl || r.photoUrl || r.avatarUrl || ""),
    rating: Math.round(Number(r.rating ?? r.stars ?? r.score ?? r.br100 ?? 5)) || 5
  });

  // ===== rendering =====
  function makeCard(r) {
    const card = document.createElement("div");
    card.className = "card enter";

    const header = document.createElement("div");
    header.className = "row";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.alt = "";
    avatar.decoding = "async";
    avatar.loading = "lazy";
    avatar.referrerPolicy = "no-referrer";
    avatar.src = r.photo || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.name;
    meta.appendChild(name);
    // NOTE: we intentionally do NOT add stars under the name anymore (per request)

    header.appendChild(avatar);
    header.appendChild(meta);
    header.appendChild(document.createElement("div")); // spacer

    const body = document.createElement("div");
    body.className = "body " + scaleClass(r.text);
    body.textContent = r.text;

    const brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = `
      <div class="brand-left">
        <img class="glogo" alt="Google" src="https://www.gstatic.com/images/branding/product/1x/google_g_32dp.png" />
      </div>
      <div class="stars">${mkStars(r.rating)}</div>
    `;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);
    return card;
  }

  // ===== rotation =====
  let items = [];
  let idx = 0;
  let current = null;
  let timerA = null, timerB = null;

  function showNext() {
    if (!items.length) return;
    const r = items[idx];
    idx = (idx + 1) % items.length;

    // create & mount
    current = makeCard(r);
    wrap.textContent = ""; // show only one
    wrap.appendChild(current);

    // schedule exit after DISPLAY_MS
    timerA = setTimeout(() => {
      if (!current) return;
      current.classList.remove("enter");
      current.classList.add("exit");
      // after exit animation, clear and wait BREAK_MS, then next
      timerB = setTimeout(() => {
        wrap.textContent = ""; current = null;
        setTimeout(showNext, BREAK_MS);
      }, EXIT_MS);
    }, DISPLAY_MS);
  }

  // ===== fetch + start =====
  async function load() {
    try {
      const res = await fetch(endpoint, { method: "GET", credentials: "omit" });
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || String(res.status));

      // parse JSON (even if sent as text/plain)
      const looksJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
      if (!looksJson) throw new Error("Expected JSON reviews array/object");

      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.reviews || []);
      if (!list.length) {
        wrap.textContent = "";
        const empty = document.createElement("div");
        empty.className = "card";
        empty.textContent = "אין ביקורות להצגה כרגע.";
        wrap.appendChild(empty);
        return;
      }
      items = list.map(normalize).filter(x => x.text || x.photo || x.name);
      if (!items.length) throw new Error("No displayable reviews");
      showNext();
    } catch (err) {
      console.error("[reviews-widget]", err);
      wrap.textContent = "";
      const errBox = document.createElement("div");
      errBox.className = "card";
      errBox.textContent = "שגיאה בטעינת הביקורות.";
      wrap.appendChild(errBox);
    }
  }

  requestAnimationFrame(load);
})();
