// review-widget v1.9 — ES5-safe, rotating cards, golden stars, 20-word cap,
// built-in promo badge (ON by default; hide with data-badge="0")
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  // Config from embed (all optional except endpoint)
  var endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS  = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 12000);
  var GAP_MS   = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 500);
  var FADE_MS  = 350;
  var DEBUG    = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");

  // --- Built-in promo badge (defaults so the embed stays minimal) ---
  // data-badge="0"      → hide badge (e.g., paid customers)
  // data-badge-url/img  → override link or image if you want
  var BADGE_TOGGLE = (scriptEl && scriptEl.getAttribute("data-badge")) || "1";
  var BADGE_URL    = (scriptEl && scriptEl.getAttribute("data-badge-url")) ||
                     "https://evid.com/free-trial";
  var BADGE_IMG    = (scriptEl && scriptEl.getAttribute("data-badge-img")) ||
    // small inline SVG (blue rounded square + white plus), URL-encoded # colors
    "https://i.ibb.co/hpM0js5/image.png";
  var BADGE_LABEL  = (scriptEl && scriptEl.getAttribute("data-badge-label")) || "Free trial";

  function log() {
    if (!DEBUG) return;
    var a = ["[reviews-widget v1.9]"];
    for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
    console.log.apply(console, a);
  }

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Styles (lives inside shadow root)
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:auto;}'
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:center;padding:12px 12px 8px;}'  // center-align name with avatar
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;display:block;}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;}'
    + '.body.small{font-size:12.5px;}'
    + '.body.tiny{font-size:11.5px;}'
    // bottom brand row
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.9;}'
    + '.gmark{display:flex;align-items:center;}'
    + '.gstars{font-size:13px;opacity:.95;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}' // golden stars
    // small close button
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.xbtn:active{transform:translateY(0);}'
    // New badge—pushed to far edge of the brand row (bottom-left in RTL, bottom-right in LTR)
    + '.badge{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;background:#0b5cff;color:#fff;padding:6px 8px;border-radius:10px;text-decoration:none;font-weight:700;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.12);transform:translateZ(0);}'
    + '.badge:hover{filter:brightness(1.05);transform:translateY(-1px);}'
    + '.badge:active{transform:translateY(0);}'
    + '.badge img{width:16px;height:16px;display:block;border-radius:4px;}'
    + '.badge span{display:none;}' // keep only the logo by default
    // Hide old per-review stars under the name (we show stars next to the Google G)
    + '.stars{display:none!important;}'
    // animations
    + '.fade-in{animation:fadeIn .35s ease forwards;}'
    + '.fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Helpers
  function mkStars(n) {
    var val = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    var out = [];
    for (var i = 0; i < 5; i++) out.push(i < val ? "★" : "☆");
    return out.join(" ");
  }
  function scaleClass(t) {
    t = (t || "").trim();
    var len = t.length;
    if (len > 220) return "tiny";
    if (len > 140) return "small";
    return "";
  }
  function truncateWords(s, n) {
    s = (s || "").replace(/\s+/g, " ").trim();
    var parts = s ? s.split(" ") : [];
    return parts.length > n ? parts.slice(0, n).join(" ") + "…" : s;
  }
  function colorFromString(s) {
    s = s || "";
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "hsl(" + (h % 360) + " 70% 45%)";
  }
  function firstLetter(s) {
    s = (s || "").trim();
    return (s[0] || "?").toUpperCase();
  }

  // Case-insensitive photo key finder
  function getPhotoUrl(obj) {
    if (!obj || typeof obj !== "object") return "";
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], lk = k.toLowerCase();
      if (lk === "photo" || lk === "reviewerphotourl" || lk === "profilephotourl" || lk === "profile_photo_url" ||
          lk === "photourl" || lk === "image" || lk === "imageurl" || lk === "avatar" || lk === "avatarurl") {
        var v = (obj[k] == null ? "" : String(obj[k])).trim();
        if (v) return v;
      }
    }
    return "";
  }

  // Normalize → {authorName, text, rating, profilePhotoUrl}
  function normalize(data) {
    var arr = [];
    if (Object.prototype.toString.call(data) === "[object Array]") arr = data;
    else if (data && typeof data === "object") {
      if (Object.prototype.toString.call(data.reviews) === "[object Array]") arr = data.reviews;
      else if (data.reviews && Object.prototype.toString.call(data.reviews.items) === "[object Array]") arr = data.reviews.items;
      else if (Object.prototype.toString.call(data.items) === "[object Array]") arr = data.items;
      else if (Object.prototype.toString.call(data.data) === "[object Array]") arr = data.data;
      else if (Object.prototype.toString.call(data.results) === "[object Array]") arr = data.results;
      else if (Object.prototype.toString.call(data.records) === "[object Array]") arr = data.records;
      else if (data.text || data.Content || data.reviewText || data.content) arr = [data];
    }
    return arr.map(function (x) {
      return {
        authorName: x.authorName || x.userName || x.Header || x.name || x.author || "Anonymous",
        text:       x.text || x.reviewText || x.Content || x.content || "",
        rating:     x.rating || x.stars || x.score || 5,
        profilePhotoUrl: x.Photo || x.reviewerPhotoUrl || getPhotoUrl(x)
      };
    });
  }

  function renderMonogram(name) {
    var div = document.createElement("div");
    div.className = "avatar-fallback";
    div.textContent = firstLetter(name);
    div.style.background = colorFromString(name);
    return div;
  }

  function renderAvatar(name, url) {
    if (url) {
      log("avatar url:", url);
      var img = document.createElement("img");
      img.className = "avatar";
      img.alt = "";
      img.width = 40; img.height = 40;
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
      img.addEventListener("load", function(){ log("avatar ok"); });
      img.addEventListener("error", function(){
        log("avatar error → fallback");
        img.replaceWith(renderMonogram(name));
      });
      return img;
    }
    log("avatar: no url → fallback");
    return renderMonogram(name);
  }

  function renderCard(r) {
    var card = document.createElement("div");
    card.className = "card fade-in";

    var header = document.createElement("div");
    header.className = "row";

    var avatarEl = renderAvatar(
      r.authorName,
      r.profilePhotoUrl || r.reviewerPhotoUrl || r.Photo
    );

    var meta = document.createElement("div");
    meta.className = "meta";
    var name = document.createElement("div");
    name.className = "name";
    name.textContent = r.authorName || "Anonymous";
    meta.appendChild(name);

    var x = document.createElement("button");
    x.className = "xbtn";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.addEventListener("click", function () {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(function () {
        card.remove();
        if (typeof loop !== "undefined" && loop) { clearInterval(loop); loop = null; }
      }, FADE_MS);
    });

    header.appendChild(avatarEl);
    header.appendChild(meta);
    header.appendChild(x);

    var body = document.createElement("div");
    var fullText = r.text || r.content || "";
    var shortText = truncateWords(fullText, 20);
    body.className = "body " + scaleClass(shortText);
    body.textContent = shortText;

    // Bottom brand row: Google G + 5 golden stars + promo badge (if enabled)
    var brand = document.createElement("div");
    brand.className = "brand";

    var showBadge = BADGE_TOGGLE !== "0";
    var badgeHtml = "";
    if (showBadge) {
      badgeHtml =
        '<a class="badge" href="' + BADGE_URL + '" target="_blank" rel="noopener noreferrer" aria-label="' + BADGE_LABEL + '">'
        + (BADGE_IMG ? '<img src="' + BADGE_IMG + '" alt="Evid">' : '<span>' + BADGE_LABEL + '</span>')
        + '</a>';
    }

    brand.innerHTML =
        '<span class="gmark" aria-label="Google">'
      + '  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
      + '    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.23 1.26-.93 2.33-1.98 3.04v2.52h3.2c1.87-1.72 2.95-4.25 2.95-7.27 0-.7-.06-1.37-.17-2.01z"></path>'
      + '    <path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36l-3.2-2.52c-.89.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56A9.818 9.818 0 0 0 12.18 22z"></path>'
      + '    <path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82V7.64H3.4a9.82 9.82 0 0 0 0 8.72l3.29-2.34z"></path>'
      + '    <path fill="#EA4335" d="M12.18 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12.18 2c-3.78 0-7.01 2.17-8.78 5.64l3.29 2.56c.77-2.32 2.93-4.7 5.49-4.7z"></path>'
      + '  </svg>'
      + '</span>'
      + '<span class="gstars" aria-label="5 star rating">★ ★ ★ ★ ★</span>'
      + badgeHtml;

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);
    return card;
  }

  // Rotation
  var reviews = [];
  var i = 0;
  var loop = null;

  function show() {
    if (!reviews.length) return;
    var card = renderCard(reviews[i % reviews.length]);
    i++;
    wrap.innerHTML = "";
    wrap.appendChild(card);
    setTimeout(function () {
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
    }, Math.max(0, SHOW_MS - FADE_MS));
  }

  // Fetch + start
  fetch(endpoint, { method: "GET", credentials: "omit", cache: "no-store" })
    .then(function (res) {
      return res.text().then(function (raw) {
        if (!res.ok) throw new Error(raw || ("HTTP " + res.status));
        try { return JSON.parse(raw); }
        catch (_) { return { reviews: [{ text: raw }] }; }
      });
    })
    .then(function (data) {
      reviews = normalize(data);
      log("fetched reviews:", reviews.length);
      if (!reviews.length) throw new Error("No reviews returned");
      i = 0;
      show();
      if (loop) clearInterval(loop);
      loop = setInterval(show, SHOW_MS + GAP_MS);
    })
    .catch(function (err) {
      root.innerHTML =
        '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">'
        + 'Widget error: ' + (err && err.message ? err.message : String(err)) +
        '</div>';
      console.error("[reviews-widget v1.9]", err);
    });
})();
