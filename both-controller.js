// both-controller v3.5.x — ES5-safe, unified UI.
// Purchases: image RIGHT, sentence LEFT, verify pill above sentence, X at top-left.
// Reviews: unchanged (Google mark + stars + optional EVID badge).
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  // ---- config from embed ----
  var REVIEWS_EP   = scriptEl && scriptEl.getAttribute("data-reviews-endpoint");
  var PURCHASES_EP = scriptEl && scriptEl.getAttribute("data-purchases-endpoint");
  var SHOW_MS   = Number((scriptEl && scriptEl.getAttribute("data-show-ms"))       || 15000);
  var GAP_MS    = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))        || 6000);
  var INIT_MS   = Number((scriptEl && scriptEl.getAttribute("data-init-delay-ms")) || 0);
  var MAX_WORDS = Number((scriptEl && scriptEl.getAttribute("data-max-words"))     || 20);
  var DEBUG     = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");
  var BADGE     = (((scriptEl && scriptEl.getAttribute("data-badge")) || "1") === "1");
  function log(){ if(DEBUG){ var a=["[both-controller v3.5.x]"]; for(var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!REVIEWS_EP && !PURCHASES_EP) {
    root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing endpoints.</div>';
    return;
  }

  // ---- styles ----
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'

    /* Card shell (shared) */
    + '.card{width:340px;max-width:90vw;background:#fff;color:#0b1220;border-radius:18px;box-shadow:0 16px 40px rgba(2,6,23,.18);border:1px solid rgba(2,6,23,.06);overflow:hidden;}'

    /* Header rows (reviews default) */
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:12px;align-items:center;padding:12px 12px 8px;direction:auto;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;}'
    + '.body.small{font-size:12.5px;} .body.tiny{font-size:11.5px;}'

    /* Avatars (reviews) */
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eef2f7;display:block;border:1px solid rgba(2,6,23,.06);}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'

    /* Footer brand (reviews) */
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(2,6,23,.07);font-size:12px;opacity:.95;direction:rtl;}'
    + '.gmark{display:flex;align-items:center;}'
    + '.gstars{font-size:13px;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}'
    + '.badgeText{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9;}'
    + '.badgeText .verified{color:#444;font-weight:600;}'
    + '.badgeText .evid{color:#000;font-weight:700;display:inline-flex;align-items:center;gap:4px;}'
    + '.badgeText .tick{font-size:12px;line-height:1;}'

    /* Close button */
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.xbtn:active{transform:translateY(0);}'

    /* Purchases layout — X | text | image (image RIGHT), RTL text alignment */
    + '.row-p{grid-template-columns:24px 1fr 96px;gap:12px;align-items:center;padding:12px 12px 8px;direction:rtl;}'
    + '.pcol{display:flex;flex-direction:column;align-items:flex-start;gap:6px;direction:rtl;}'
    + '.vpill{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:9999px;background:#E9F9EE;border:1px solid rgba(16,185,129,.25);box-shadow:0 0 0 1px rgba(16,185,129,.06) inset;color:#0F9D58;font-weight:700;font-size:12px;white-space:nowrap;margin-inline-end:6px;}'
    + '.vcheck{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:9999px;background:#22C55E;color:#fff;font-size:12px;line-height:1;}'
    + '.psentence{font-weight:600;font-size:15px;line-height:1.3;text-align:right;font-family:"Assistant",ui-sans-serif,system-ui;}'
    + '.psentence .buyer{font-weight:700;}'
    + '.psentence .product{font-weight:700;color:#1677ff;}'
    + '.pimg{justify-self:end;width:96px;height:96px;border-radius:14px;object-fit:cover;background:#eef2f7;display:block;border:1px solid rgba(2,6,23,.06);}'
    + '.pimg-fallback{justify-self:end;width:96px;height:96px;border-radius:14px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#475569;}'
    + '.timebar{display:flex;align-items:center;gap:6px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(2,6,23,.07);font-size:12.5px;color:#475569;direction:rtl;}'
    + '.clock{font-size:13px;opacity:.9;}'

    /* Animations */
    + '.fade-in{animation:fadeIn .35s ease forwards;} .fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'

    /* Mobile compact */
    + '@media (max-width:480px){'
    + '  .card{width:300px}'
    + '  .row{grid-template-columns:34px 1fr 22px;gap:8px;padding:10px 10px 6px}'
    + '  .avatar,.avatar-fallback{width:34px;height:34px}'
    + '  .name{font-size:13px}'
    + '  .body{font-size:13px;line-height:1.3;padding:0 10px 10px}'
    + '  .row-p{grid-template-columns:24px 1fr 84px;gap:10px;padding:10px 10px 6px}'
    + '  .pimg,.pimg-fallback{width:84px;height:84px}'
    + '  .psentence{font-size:14px}'
    + '  .vpill{font-size:11.5px;padding:3px 9px}'
    + '  .timebar{font-size:11.5px}'
    + '}'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // ---- helpers ----
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function renderMonogram(name){
    var d=document.createElement("div");
    d.className="avatar-fallback";
    d.textContent=firstLetter(name);
    d.style.background=colorFromString(name);
    return d;
  }
  function renderAvatarPreloaded(name, url){
    var shell = renderMonogram(name);
    if(url){
      var img = new Image();
      img.width=40; img.height=40; img.decoding="async"; img.loading="eager";
      img.onload = function(){
        var tag=document.createElement("img");
        tag.className="avatar"; tag.alt="";
        tag.width=40; tag.height=40; tag.decoding="async"; tag.loading="eager"; tag.src=url;
        shell.replaceWith(tag);
      };
      img.onerror = function(){};
      img.src = url;
    }
    return shell;
  }
  function truncateWords(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function scaleClass(text){ var t=(text||"").trim(), L=t.length; if(L>220) return "tiny"; if(L>140) return "small"; return ""; }
  function timeAgo(ts){
    try{
      var d=new Date(ts); var diff=Math.max(0,(Date.now()-d.getTime())/1000);
      var m=Math.floor(diff/60), h=Math.floor(m/60), d2=Math.floor(h/24);
      if(d2>0) return d2===1?"אתמול":"לפני "+d2+" ימים";
      if(h>0) return "לפני "+h+" שעות";
      if(m>0) return "לפני "+m+" דקות";
      return "כרגע";
    }catch(_){ return ""; }
  }
  function firstName(s){
    s = String(s||"").trim();
    if(!s) return "";
    var parts = s.split(/\s+/);
    return parts[0] || s;
  }

  // ---- normalizers ----
  function getPhotoUrl(o){
    if(!o||typeof o!=="object") return "";
    var k=Object.keys(o);
    for(var i=0;i<k.length;i++){
      var n=k[i], ln=n.toLowerCase();
      if(ln==="photo"||ln==="reviewerphotourl"||ln==="profilephotourl"||ln==="profile_photo_url"||
         ln==="photourl"||ln==="image"||ln==="imageurl"||ln==="avatar"||ln==="avatarurl"){
        var v = (o[n]==null?"":String(o[n])).trim();
        if(v) return v;
      }
    }
    return "";
  }
  function normReview(x){
    return {
      kind: "review",
      authorName: x.authorName||x.userName||x.Header||x.name||x.author||"Anonymous",
      text:       x.text||x.reviewText||x.Content||x.content||"",
      rating:     x.rating||x.stars||x.score||5,
      profilePhotoUrl: x.Photo||x.reviewerPhotoUrl||getPhotoUrl(x)
    };
  }
  function normPurchase(x){
    return {
      kind: "purchase",
      buyer:   x.buyer||x.buyerName||x.customerName||x.name||x.customer||"לקוח/ה",
      product: x.product||x.productName||x.item||x.title||"מוצר",
      image:   x.productImage||x.image||"",
      purchased_at: x.purchased_at || new Date().toISOString()
    };
  }
  function normalizeArray(data, as){
    var arr=[]; if(Object.prototype.toString.call(data)==="[object Array]") arr=data;
    else if(data&&typeof data==="object"){
      if(Object.prototype.toString.call(data.items)==="[object Array]") arr=data.items;
      else if(Object.prototype.toString.call(data.data)==="[object Array]") arr=data.data;
      else if(Object.prototype.toString.call(data.results)==="[object Array]") arr=data.results;
      else if(Object.prototype.toString.call(data.records)==="[object Array]") arr=data.records;
      else if(Object.prototype.toString.call(data.reviews)==="[object Array]") arr=data.reviews;
      else if(data.text||data.Content||data.reviewText||data.content) arr=[data];
    }
    if(as==="review")  return arr.map(normReview);
    if(as==="purchase")return arr.map(normPurchase);
    return arr;
  }

  function purchaseHTML(buyer, product){
    var b = firstName(buyer||"");
    var p = String(product||"מוצר");
    return '<span class="buyer">'+(b||"לקוח/ה")+'</span> רכש/ה <span class="product">'+p+'</span>';
  }

  // ---- renderers ----
  function renderReviewCard(item){
    var card=document.createElement("div"); card.className="card fade-in";
    var header=document.createElement("div"); header.className="row";
    var avatarEl = renderAvatarPreloaded(item.authorName, item.profilePhotoUrl);

    var meta=document.createElement("div"); meta.className="meta";
    var name=document.createElement("div"); name.className="name";
    name.textContent=item.authorName||"Anonymous"; meta.appendChild(name);

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 350); });

    header.appendChild(avatarEl); header.appendChild(meta); header.appendChild(x);

    var body=document.createElement("div");
    var shortText=truncateWords(item.text, MAX_WORDS);
    body.className="body "+scaleClass(shortText); body.textContent=shortText;

    var brand=document.createElement("div"); brand.className="brand";
    brand.innerHTML = ''
      + '<span class="gmark" aria-label="Google">'
      + '  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
      + '    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.23 1.26-.93 2.33-1.98 3.04v2.52h3.2c1.87-1.72 2.95-4.25 2.95-7.27 0-.7-.06-1.37-.17-2.01z"></path>'
      + '    <path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36l-3.2-2.52c-.89.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56A9.818 9.818 0 0 0 12.18 22z"></path>'
      + '    <path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82V7.64H3.4a9.82 9.82 0 0 0 0 8.72"></path>'
      + '    <path fill="#EA4335" d="M12.18 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12.18 2c-3.78 0-7.01 2.17-8.78 5.64"></path>'
      + '  </svg>'
      + '</span>'
      + '<span class="gstars" aria-label="5 star rating">★ ★ ★ ★ ★</span>'
      + (BADGE ? '<span class="badgeText" aria-label="Verified by Evid"><span class="verified">מאומת</span><span class="evid">EVID<span class="tick" aria-hidden="true">✓</span></span></span>' : '');
    card.appendChild(header); card.appendChild(body); card.appendChild(brand);
    return card;
  }

  function renderPurchaseCard(p){
    var card=document.createElement("div"); card.className="card fade-in";

    // X | text(col) | image
    var header=document.createElement("div"); header.className="row row-p";

    // X button (left)
    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 350); });

    // Text column (right-to-left content)
    var textCol=document.createElement("div"); textCol.className="pcol";

    // Verify pill (one line, small)
    var pill=document.createElement("div"); pill.className="vpill";
    pill.innerHTML = '<span class="vcheck">✓</span><span>מאומת <b>EVID</b></span>';
    textCol.appendChild(pill);

    // Main sentence
    var sentence=document.createElement("div"); sentence.className="psentence";
    sentence.innerHTML = purchaseHTML(p.buyer, p.product);
    textCol.appendChild(sentence);

    // Product image (right)
    var imgEl;
    function fallbackBox(){ var d=document.createElement("div"); d.className="pimg-fallback"; d.textContent="✓"; return d; }
    function replaceWith(el){ if(imgEl && imgEl.parentNode){ imgEl.parentNode.replaceChild(el, imgEl); } imgEl = el; }
    if (p.image) {
      var pre = new Image();
      pre.decoding = "async"; pre.loading = "eager";
      pre.onload = function(){ var tag=document.createElement("img"); tag.className="pimg"; tag.alt=""; tag.src=p.image; replaceWith(tag); };
      pre.onerror = function(){ replaceWith(fallbackBox()); };
      pre.src = p.image;
      imgEl = fallbackBox();
    } else {
      imgEl = fallbackBox();
    }

    // Order: X | text | image  (so image is RIGHT)
    header.appendChild(x);
    header.appendChild(textCol);
    header.appendChild(imgEl);

    // Footer with clock + time
    var footer=document.createElement("div"); footer.className="timebar";
    var ico=document.createElement("span"); ico.className="clock"; ico.textContent="🕒";
    var t=document.createElement("span"); t.textContent=timeAgo(p.purchased_at);
    footer.appendChild(t); footer.appendChild(ico);

    card.appendChild(header);
    card.appendChild(footer);
    return card;
  }

  // ---- interleave ----
  function interleave(reviews, purchases){
    var out=[], i=0, j=0;
    while(i<reviews.length || j<purchases.length){
      if(i<reviews.length){ out.push({kind:"review", data:reviews[i++]}); }
      if(j<purchases.length){ out.push({kind:"purchase", data:purchases[j++]}); }
    }
    return out;
  }

  // ---- rotation ----
  var items=[], idx=0, loop=null;
  function showNext(){
    if(!items.length) return;
    var itm = items[idx % items.length]; idx++;
    var card = (itm.kind==="purchase") ? renderPurchaseCard(itm.data) : renderReviewCard(itm.data);
    wrap.innerHTML=""; wrap.appendChild(card);
    setTimeout(function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); }, Math.max(0, SHOW_MS - 350));
    setTimeout(function(){ if(card && card.parentNode){ card.parentNode.removeChild(card); } }, SHOW_MS);
  }
  function start(){
    if(loop) clearInterval(loop);
    if(!items.length){
      root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">No items to display.</div>';
      return;
    }
    if (INIT_MS > 0) { setTimeout(function(){ showNext(); loop=setInterval(showNext, SHOW_MS + GAP_MS); }, INIT_MS); }
    else { showNext(); loop=setInterval(showNext, SHOW_MS + GAP_MS); }
  }

  // ---- fetch ----
  function fetchText(url){ return fetch(url,{method:"GET",credentials:"omit",cache:"no-store"}).then(function(res){ return res.text().then(function(raw){ if(!res.ok) throw new Error(raw || ("HTTP "+res.status)); return raw; }); }); }
  function fetchJSON(url){ return fetchText(url).then(function(raw){ try{ return JSON.parse(raw); }catch(_){ return { items: [] }; } }); }

  function loadAll(){
    var p1 = REVIEWS_EP ? fetchJSON(REVIEWS_EP).then(function(d){ return normalizeArray(d,"review"); }).catch(function(e){ log("reviews fetch err:", e); return []; }) : Promise.resolve([]);
    var p2 = PURCHASES_EP ? fetchJSON(PURCHASES_EP).then(function(d){ return normalizeArray(d,"purchase");}).catch(function(e){ log("purchases fetch err:", e); return []; }) : Promise.resolve([]);
    Promise.all([p1,p2]).then(function(r){
      var rev = r[0]||[], pur = r[1]||[];
      items = interleave(rev, pur);
      start();
    }).catch(function(e){
      root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Widget error: '+ String(e && e.message || e) +'</div>';
      console.error("[both-controller v3.5.x]", e);
    });
  }

  loadAll();
})();
