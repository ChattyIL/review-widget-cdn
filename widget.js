// review-widget v1.8 — ES5-safe (no arrow/optional chaining), robust avatar mapping + rotation
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  var endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 12000);
  var GAP_MS  = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 500);
  var FADE_MS = 350;
  var DEBUG   = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");

  function log() {
    if (!DEBUG) return;
    var args = ["[reviews-widget v1.8]"];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    console.log.apply(console, args);
  }

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  var style = document.createElement("style");
  style.textContent = ''
    + ':host{all:initial;}'
    + '.wrap{position:fixed;inset-inline-end:16px;inset-block-end:16px;z-index:2147483000;'
    + 'font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;'
    + 'box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:auto;}'
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:start;padding:12px 12px 8px;}'
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;display:block;}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.stars{margin-top:4px;font-size:13px;opacity:.9}'
    + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;}'
    + '.body.small{font-size:12.5px;}'
    + '.body.tiny{font-size:11.5px;}'
    + '.brand{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;'
    + 'border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.9;}'
    + '.xbtn{appearance:none;border:0;background:transparent;cursor:pointer;font-size:18px;line-height:1;padding:0;opacity:.6;}'
    + '.xbtn:hover{opacity:1;}'
    + '.fade-in{animation:fadeIn '+FADE_MS+'ms ease forwards;}'
    + '.fade-out{animation:fadeOut '+FADE_MS+'ms ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}';
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

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

  // Case-insensitive photo key finder (covers Photo, reviewerPhotoUrl, etc.)
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

  // Normalize many shapes → {authorName, text, rating, profilePhotoUrl}
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
        // Prefer explicit Photo / reviewerPhotoUrl, then fall back to other common fields
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
    var stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = mkStars(r.rating);
    meta.appendChild(name);
    meta.appendChild(stars);

    var x = document.createElement("button");
    x.className = "xbtn";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";

    header.appendChild(avatarEl);
    header.appendChild(meta);
    header.appendChild(x);

    var body = document.createElement("div");
    body.className = "body " + scaleClass(r.text);
    body.textContent = r.text;

    var brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = '<span>Google Reviews</span><span>⭐️⭐️⭐️⭐️⭐️</span>';

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(brand);

    x.addEventListener("click", function () {
      if (loop) { clearInterval(loop); loop = null; }
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(function () { card.remove(); }, FADE_MS);
    });

    return card;
  }

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
    .then(function (res) { return res.text().then(function (raw) {
      if (!res.ok) throw new Error(raw || ("HTTP " + res.status));
      try { return JSON.parse(raw); }
      catch (e) { return { reviews: [{ text: raw }] }; }
    }); })
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
      console.error("[reviews-widget v1.8]", err);
    });
})();
