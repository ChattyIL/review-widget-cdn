/*! both-controller v3.6.4 — Assistant no-FOUT, image prewarm, sticky review (mobile),
    smooth animations, Google icon safe, and PERSISTED rotation across pages (fixed gap resume).
    + Dismiss persistence: remember index on ✕, 45s cooldown across pages.
    + "קרא עוד" pill for multi-line reviews (2-line clamp), with pause/resume timer.
    + Skip reviews that have no text.
*/
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  /* ---- config ---- */
  var REVIEWS_EP   = scriptEl && scriptEl.getAttribute("data-reviews-endpoint");
  var PURCHASES_EP = scriptEl && scriptEl.getAttribute("data-purchases-endpoint");
  var SHOW_MS   = Number((scriptEl && scriptEl.getAttribute("data-show-ms"))       || 15000);
  var GAP_MS    = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))        || 6000);
  var INIT_MS   = Number((scriptEl && scriptEl.getAttribute("data-init-delay-ms")) || 0);

  // --- Dismiss persistence (new)
  var DISMISS_COOLDOWN_MS = Number((scriptEl && scriptEl.getAttribute("data-dismiss-cooldown-ms")) || 45000);

  var DEBUG = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");
  var BADGE = (((scriptEl && scriptEl.getAttribute("data-badge")) || "1") === "1");
  function log(){ if (DEBUG) { var a=["[both-controller v3.6.4]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!REVIEWS_EP && !PURCHASES_EP) {
    root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing endpoints.</div>';
    return;
  }

  /* =========================
     Assistant font: no FOUT
     ========================= */
  var ASSIST_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=block';
  function ensureAssistantInHead(){
    try{
      if (!document.getElementById('asst-preconnect-goog')) {
        var pc1=document.createElement('link'); pc1.id='asst-preconnect-goog';
        pc1.rel='preconnect'; pc1.href='https://fonts.googleapis.com';
        document.head.appendChild(pc1);
      }
      if (!document.getElementById('asst-preconnect-gstatic')) {
        var pc2=document.createElement('link'); pc2.id='asst-preconnect-gstatic';
        pc2.rel='preconnect'; pc2.href='https://fonts.gstatic.com'; pc2.crossOrigin='anonymous';
        document.head.appendChild(pc2);
      }
      var link = document.getElementById('asst-font-css');
      if (!link) {
        link = document.createElement('link');
        link.id = 'asst-font-css';
        link.rel = 'stylesheet';
        link.href = ASSIST_HREF;
        document.head.appendChild(link);
      }
      return new Promise(function(resolve){
        var done=false;
        function finish(){ if(done) return; done=true;
          try{
            var p = document.fonts ? Promise.all([
              document.fonts.load('400 14px "Assistant"'),
              document.fonts.load('600 14px "Assistant"'),
              document.fonts.load('700 14px "Assistant"'),
              document.fonts.ready
            ]) : Promise.resolve();
            p.then(resolve).catch(resolve);
          }catch(_){ resolve(); }
        }
        if (link.sheet) finish();
        else {
          link.addEventListener('load', finish, {once:true});
          link.addEventListener('error', finish, {once:true});
        }
        setTimeout(finish, 2500);
      });
    }catch(_){ return Promise.resolve(); }
  }

  /* ========== styles (no @import here) ========== */
  var style = document.createElement("style");
  style.textContent = ''
  + ':host{all:initial;}'
  + ':host, :host *, .wrap, .wrap *, .card, .card *{'
  + '  font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,"Noto Sans Hebrew",Heebo,sans-serif!important;'
  + '  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;'
  + '}'
  + '.wrap{visibility:hidden;opacity:0;transition:opacity .15s ease;position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;}'
  + '.wrap.ready{visibility:visible;opacity:1;}'

  /* Card */
  + '.card{position:relative;width:370px;max-width:92vw;background:#fff;color:#0b1220;border-radius:18px;box-shadow:0 16px 40px rgba(2,6,23,.18);border:1px solid rgba(2,6,23,.06);overflow:visible;}'
  + '.xbtn{position:absolute;top:10px;left:10px;appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
  + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;} .xbtn:active{transform:translateY(0);}'

  /* Reviews */
  + '.row-r{display:grid;grid-template-columns:40px 1fr 24px;gap:12px;align-items:center;padding:12px 12px 8px;direction:rtl;}'
  + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eef2f7;display:block;border:1px solid rgba(2,6,23,.06);}'
  + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
  + '.meta{display:flex;flex-direction:column;gap:4px;}'
  + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
  + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;direction:rtl;}'
  + '.body.clamped{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'
  + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(2,6,23,.07);font-size:12px;opacity:.95;direction:rtl;overflow:visible;}'
  + '.gmark{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;overflow:visible;}'
  + '.gmark svg{width:18px;height:18px;display:block;overflow:visible;}'
  + '.gstars{font-size:13px;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}'
  + '.badgeText{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9;}'
  + '.badgeText .verified{color:#444;font-weight:600;}'
  + '.badgeText .evid{color:#000;font-weight:700;display:inline-flex;align-items:center;gap:4px;}'
  + '.badgeText .tick{font-size:12px;line-height:1;}'

  /* Read-more pill (floating just outside the card above name/avatar) */
  + '.readmore-pill{position:absolute;top:0;right:92px;transform:translateY(-50%);background:#0f172a;color:#fff;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:600;border:none;cursor:pointer;box-shadow:0 8px 22px rgba(15,23,42,.4);white-space:nowrap;z-index:4;}'
  + '.readmore-pill:hover{background:#020617;}'

  /* Purchases (compact) */
  + '.p-top{display:grid;grid-template-columns:1fr 168px;gap:12px;align-items:center;padding:13px 12px 6px;direction:ltr;}'
  + '.ptext{grid-column:1;display:flex;flex-direction:column;gap:4px;align-items:stretch;direction:rtl;}'
  + '.ptime-top{display:flex;align-items:center;gap:6px;justify-content:center;font-size:12.5px;color:#1f2937;opacity:.92;text-align:right;direction:rtl;margin:0;}'
  + '.ptime-top svg{width:14px;height:14px;opacity:.95;display:block;}'
  + '.psentence{max-width:100%;text-align:right;font-size:15px;line-height:1.35;margin:0;word-break:break-word;}'
  + '.psentence .buyer{font-weight:700;}'
  + '.psentence .prod{font-weight:700;color:#2578ff;}'
  + '.pmedia{grid-column:2;justify-self:end;display:flex;align-items:center;justify-content:center;position:relative;}'
  + '.pframe{position:relative;width:160px;height:116px;border-radius:14px;border:2px solid #dfe7f0;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;}'
  + '.pimg{width:100%;height:100%;object-fit:contain;background:#fff;display:block;}'
  + '.pimg-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-weight:700;background:#f1f5f9;}'
  + '.hotcap{position:absolute;top:-12px;left:50%;transform:translateX(-50%);z-index:3;}'
  + '.badge-hot{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font:700 12.5px/1.1 "Assistant",system-ui,-apple-system,Segoe UI,Heebo,Arial,sans-serif;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;box-shadow:0 1px 0 rgba(0,0,0,.04);white-space:nowrap;}'
  + '.badge-hot svg{width:14px;height:14px}'
  + '.pulse{animation:pulse 2.8s ease-in-out infinite}'
  + '@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0)}50%{box-shadow:0 0 0 8px rgba(249,115,22,.12)}}'
  + '.p-foot{display:none!important;}'

  /* Animations */
  + '.enter{animation:floatIn .42s cubic-bezier(.22,.61,.36,1) forwards;}'
  + '.leave{animation:floatOut .36s cubic-bezier(.22,.61,.36,1) forwards;}'
  + '@keyframes floatIn{0%{opacity:0;transform:translateY(10px) scale(.98);filter:blur(2px);}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0);}}'
  + '@keyframes floatOut{0%{opacity:1;transform:translateY(0) scale(1);filter:blur(0);}100%{opacity:0;transform:translateY(8px) scale(.985);filter:blur(1px);}}'

  /* Mobile: reviews stick to bottom, purchases float */
  + '@media (max-width:480px){'
  + '  .wrap.sticky-review{right:0;left:0;bottom:0;padding:0 0 env(safe-area-inset-bottom,0);}'
  + '  .wrap.sticky-review .card.review-card{width:100%;max-width:none;border-radius:16px 16px 0 0;margin:0;}'
  + '  .row-r{padding:12px 10px 8px;}'
  + '  .p-top{grid-template-columns:1fr 144px;padding:13px 10px 6px;gap:10px;}'
  + '  .pframe{width:144px;height:104px;}'
  + '  .hotcap{top:-10px;}'
  + '  .card.review-card .readmore-pill{right:86px;top:0;transform:translateY(-50%);font-size:10px;padding:4px 8px;}'
  + '}'
  + '@media (min-width:720px){ .pframe{width:160px;height:116px;} }'
  ;
  root.appendChild(style);

  /* wrapper (revealed after font is ready) */
  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  /* ---- helpers ---- */
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function escapeHTML(s){ return String(s||"").replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;","&gt;":">","\"":"&quot;","'":"&#39;"}[c]);}); }
  function firstName(s){ s=String(s||"").trim(); var parts=s.split(/\s+/); return parts[0]||s; }

  function normalizeSpaces(text){
    return (text||"").replace(/\s+/g," ").trim();
  }

  function timeAgo(ts){
    try{ var d=new Date(ts);
      var diff=Math.max(0,(Date.now()-d.getTime())/1000);
      var m=Math.floor(diff/60), h=Math.floor(m/60), d2=Math.floor(h/24);
      if(d2>0) return d2===1?"אתמול":"לפני "+d2+" ימים";
      if(h>0) return "לפני "+h+" שעות";
      if(m>0) return "לפני "+m+" דקות";
      return "כרגע";
    }catch(_){ return ""; }
  }

  /* Avatar helpers */
  function renderMonogram(name){ var d=document.createElement("div"); d.className="avatar-fallback"; d.textContent=firstLetter(name); d.style.background=colorFromString(name); return d; }
  function renderAvatarPreloaded(name, url){
    var shell = renderMonogram(name);
    if(url){
      var img = new Image(); img.width=40; img.height=40; img.decoding="async"; img.loading="eager";
      img.onload=function(){ var tag=document.createElement("img"); tag.className="avatar"; tag.alt=""; tag.width=40; tag.height=40; tag.decoding="async"; tag.loading="eager"; tag.src=url; shell.replaceWith(tag); };
      img.onerror=function(){}; img.src=url;
    }
    return shell;
  }

  /* Image preloader */
  var IMG_CACHE = new Map();
  function warmImage(url){
    if(!url) return Promise.resolve();
    if(IMG_CACHE.has(url)) return IMG_CACHE.get(url);
    var pr = new Promise(function(resolve){
      try{
        var im = new Image();
        im.decoding = "async"; im.loading = "eager";
        im.onload = function(){ resolve(url); };
        im.onerror = function(){ resolve(url); };
        im.src = url;
      }catch(_){ resolve(url); }
    });
    IMG_CACHE.set(url, pr);
    return pr;
  }
  function warmForItem(itm){
    if(!itm) return Promise.resolve();
    if(itm.kind==="review") return warmImage(itm.data && itm.data.profilePhotoUrl);
    if(itm.kind==="purchase") return warmImage(itm.data && itm.data.image);
    return Promise.resolve();
  }

  /* ---- robust parsers ---- */
  function getPhotoUrl(o){
    if(!o||typeof o!=="object") return "";
    var k=Object.keys(o); for(var i=0;i<k.length;i++){ var n=k[i], ln=n.toLowerCase();
      if(ln==="photo"||ln==="reviewerphotourl"||ln==="profilephotourl"||ln==="profile_photo_url"||ln==="photourl"||ln==="image"||ln==="imageurl"||ln==="avatar"||ln==="avatarurl"||ln==="productimage"){
        var v = (o[n]==null?"":String(o[n])).trim(); if(v) return v;
      } }
    return "";
  }
  function normReview(x){ 
    return { kind:"review",
      authorName:x.authorName||x.userName||x.Header||x.name||x.author||"Anonymous",
      text:x.text||x.reviewText||x.Content||x.content||"",
      rating:x.rating||x.stars||x.score||5,
      profilePhotoUrl:x.Photo||x.reviewerPhotoUrl||getPhotoUrl(x)
    };
  }
  function normPurchase(x){
    return { kind:"purchase",
      buyer:x.buyer||x.buyerName||x.customerName||x.name||x.customer||"לקוח/ה",
      product:x.product||x.productName||x.item||x.title||"מוצר",
      image:x.productImage||x.image||getPhotoUrl(x)||"",
      purchased_at:x.purchased_at||x.created_at||x.time||x.timestamp||new Date().toISOString()
    };
  }
  function normalizeArray(data, as){
    var arr=[];
    if(Array.isArray(data)) arr=data;
    else if(data&&typeof data==="object"){
      if(Array.isArray(data.items))      arr=data.items;
      else if(Array.isArray(data.data))  arr=data.data;
      else if(Array.isArray(data.results)) arr=data.results;
      else if(Array.isArray(data.records)) arr=data.records;
      else if(Array.isArray(data.reviews)) arr=data.reviews;
      else if(Array.isArray(data.purchases)) arr=data.purchases;
      else if(Array.isArray(data.purchase))  arr=data.purchase;
      else if(Array.isArray(data.orders))    arr=data.orders;
      else if(Array.isArray(data.events))    arr=data.events;
      else if(data.text||data.Content||data.reviewText||data.content||data.product||data.item||data.title) arr=[data];
    }
    if(as==="review")   return arr.map(normReview);
    if(as==="purchase") return arr.map(normPurchase);
    return arr;
  }

  /* fetchers with mirror failover */
  var JS_MIRRORS = ["https://cdn.jsdelivr.net","https://fastly.jsdelivr.net","https://gcore.jsdelivr.net"];
  function rewriteToMirror(u, mirror){ try { var a=new URL(u), m=new URL(mirror); a.protocol=m.protocol; a.host=m.host; return a.toString(); } catch(_){ return u; } }
  function fetchTextWithMirrors(u){
    var opts = {method:"GET", credentials:"omit", cache:"no-store"};
    var i = 0, isJSD = /(^https?:)?\/\/([^\/]*jsdelivr\.net)/i.test(u);
    var urlWithBuster = u + (u.indexOf('?')>-1?'&':'?') + 't=' + Date.now();
    function attempt(url){
      return fetch(url, opts).then(function(res){
        return res.text().then(function(raw){
          if(!res.ok) throw new Error(raw || ("HTTP "+res.status));
          return raw;
        });
      }).catch(function(err){
        if(isJSD && i < JS_MIRRORS.length-1){
          i++; var next = rewriteToMirror(u, JS_MIRRORS[i]);
          if (DEBUG) console.warn("[both-controller] mirror retry", next);
          return attempt(next + (next.indexOf('?')>-1?'&':'?') + 't=' + Date.now());
        }
        throw err;
      });
    }
    return attempt(urlWithBuster);
  }
  function fetchJSON(url){ return fetchTextWithMirrors(url).then(function(raw){ try{ return JSON.parse(raw); }catch(_){ return { items: [] }; } }); }

  /* ---------- persistence (keep position across pages) ---------- */
  var STORAGE_KEY = 'evid:widget-state:v1';
  var itemsSig = "0_0";

  function itemsSignature(arr){
    try {
      var s = "";
      for (var i=0; i<Math.min(10, arr.length); i++){
        var it = arr[i];
        if (!it || !it.data) continue;
        s += (it.kind||"") + ":" +
             (it.data.authorName||it.data.buyer||"") + "|" +
             (it.data.text||it.data.product||"");
      }
      var h=0; for(var j=0;j<s.length;j++) h=(h*31 + s.charCodeAt(j))>>>0;
      return h + "_" + arr.length;
    } catch(_){ return "0_0"; }
  }

  // Save full state (optionally include dismiss flags)
  function saveState(idxShown, sig, opt){
    try {
      var st = {
        idx: idxShown,
        shownAt: Date.now(),
        sig: sig,
        show: SHOW_MS,
        gap: GAP_MS
      };
      if (opt && opt.manualClose)   st.manualClose = true;
      if (opt && opt.snoozeUntil)   st.snoozeUntil = Number(opt.snoozeUntil)||0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch(_) {}
  }

  function restoreState(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(_){ return null; }
  }

  // Keep shownAt untouched when only the index must be updated (e.g., unload)
  function updateIndexOnly(newIdx, sig){
    try{
      var st = restoreState();
      if(!st){ return; }
      st.idx = newIdx;
      if (sig) st.sig = sig;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    }catch(_){}
  }

  /* ---------- interleave ---------- */
  function interleave(reviews, purchases){
    var out=[], i=0, j=0;
    while(i<reviews.length || j<purchases.length){
      if(i<reviews.length){ out.push({kind:"review", data:reviews[i++]}); }
      if(j<purchases.length){ out.push({kind:"purchase", data:purchases[j++]}); }
    }
    return out;
  }

  /* ---- rotation + timers ---- */
  var items=[], idx=0, loop=null, preTimer=null;

  // --- Dismiss persistence: flag to stop showing on this page after ✕
  var isDismissed = false;

  // timers for current card
  var currentCard = null;
  var fadeTimeout = null;
  var removeTimeout = null;
  var currentShowStart = 0;
  var currentShowDuration = 0;
  var remainingShowMs = 0;
  var isPausedForReadMore = false;

  function clearShowTimers(){
    if(fadeTimeout){ clearTimeout(fadeTimeout); fadeTimeout = null; }
    if(removeTimeout){ clearTimeout(removeTimeout); removeTimeout = null; }
  }

  function scheduleHide(showFor){
    clearShowTimers();
    if(!currentCard) return;
    currentShowDuration = showFor;
    currentShowStart = Date.now();
    var fadeOutMs = Math.max(0, showFor - 360);

    fadeTimeout = setTimeout(function(){
      if(!currentCard) return;
      currentCard.classList.remove("enter");
      currentCard.classList.add("leave");
    }, fadeOutMs);

    removeTimeout = setTimeout(function(){
      if(currentCard && currentCard.parentNode){
        currentCard.parentNode.removeChild(currentCard);
      }
      currentCard = null;
    }, showFor);
  }

  function pauseForReadMore(){
    if(isPausedForReadMore || !currentCard) return;
    isPausedForReadMore = true;

    if(loop){ clearInterval(loop); loop = null; }
    if(preTimer){ clearTimeout(preTimer); preTimer = null; }

    var now = Date.now();
    var elapsed = now - currentShowStart;
    remainingShowMs = Math.max(0, currentShowDuration - elapsed);

    clearShowTimers();
  }

  function resumeFromReadMore(){
    if(!isPausedForReadMore || !currentCard) return;
    isPausedForReadMore = false;

    var showMs = Math.max(300, remainingShowMs || 300);
    scheduleHide(showMs);

    preTimer = setTimeout(function(){
      startFrom(0);
    }, showMs + GAP_MS);
  }

  /* ---- renderers ---- */
  function renderReviewCard(item){
    var card=document.createElement("div"); card.className="card review-card enter";

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click", function(){
      // --- Dismiss persistence (new)
      handleDismiss();
      clearShowTimers();
      card.classList.remove("enter");
      card.classList.add("leave");
      setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 360);
    });
    card.appendChild(x);

    var header=document.createElement("div"); header.className="row-r";
    var avatarEl = renderAvatarPreloaded(item.authorName, item.profilePhotoUrl);
    var meta=document.createElement("div"); meta.className="meta";
    var name=document.createElement("div"); name.className="name"; name.textContent=item.authorName||"Anonymous";
    meta.appendChild(name);
    header.appendChild(avatarEl); header.appendChild(meta); header.appendChild(document.createElement("span"));

    var fullText = normalizeSpaces(item.text);

    var body=document.createElement("div");
    body.className="body";        // start un-clamped, we'll decide in _setupReadMore
    body.textContent=fullText;
    body.dataset.expanded = "0";  // default collapsed; may change if no overflow
    body._twoLineMaxHeight = "";

    var readMore = null;
    function ensureReadMore(){
      if(readMore) return;
      readMore = document.createElement("button");
      readMore.type = "button";
      readMore.className = "readmore-pill";
      readMore.textContent = "קרא עוד";

      readMore.addEventListener("click", function(e){
        e.stopPropagation();
        if (body.dataset.expanded === "0") {
          // collapsed → expand & pause timer
          body.dataset.expanded = "1";
          body.classList.remove("clamped");
          body.style.maxHeight = "";
          body.style.overflow = "";
          readMore.textContent = "סגור";
          pauseForReadMore();
        } else {
          // expanded → collapse & resume timer
          body.dataset.expanded = "0";
          body.classList.add("clamped");
          if (body._twoLineMaxHeight) {
            body.style.maxHeight = body._twoLineMaxHeight;
          }
          body.style.overflow = "hidden";
          readMore.textContent = "קרא עוד";
          resumeFromReadMore();
        }
      });

      card.appendChild(readMore);
    }

    // Decide if we need clamping and the button, based on actual height
    card._setupReadMore = function(){
      try{
        var style = window.getComputedStyle(body);
        var lh = parseFloat(style.lineHeight);
        if(!lh || isNaN(lh)){
          var fs = parseFloat(style.fontSize) || 14;
          lh = fs * 1.35;
        }
        var twoLineHeight = lh * 2;
        var fullHeight = body.scrollHeight;

        if (fullHeight > twoLineHeight + 1) {
          // Needs more than 2 lines → clamp to exactly 2 lines and show button
          body._twoLineMaxHeight = twoLineHeight + "px";
          body.style.maxHeight = body._twoLineMaxHeight;
          body.style.overflow = "hidden";
          body.classList.add("clamped");
          body.dataset.expanded = "0";
          ensureReadMore();
        } else {
          // Fits into 2 lines → show full text, no button
          body.classList.remove("clamped");
          body.style.maxHeight = "";
          body.style.overflow = "";
          body.dataset.expanded = "1";
        }
      }catch(_){}
    };

    var brand=document.createElement("div"); brand.className="brand";
    brand.innerHTML = ''
      + '<span class="gmark" aria-label="Google">'
      + '  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">'
      + '    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.26 1.43-1.03 2.6-2.18 3.38l2.57 2.04C20.06 18.15 21.35 15.87 21.35 13c0-.64-.06-1.24-.17-1.9z"></path>'
      + '    <path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36l-3.2-2.52c-.9.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56C5.12 20.47 8.39 22 12.18 22z"></path>'
      + '    <path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82V7.64H3.4a9.82 9.82 0 0 0 0 8.72z"></path>'
      + '    <path fill="#EA4335" d="M12.18 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12.18 2C8.4 2 5.17 4.17 3.4 7.64l3.29 2.56C7.46 7.88 9.62 5.5 12.18 5.5z"></path>'
      + '  </svg>'
      + '</span>'
      + '<span class="gstars" aria-label="5 star rating">★ ★ ★ ★ ★</span>'
      + (BADGE ? '<span class="badgeText" aria-label="Verified by Evid"><span class="verified">מאומת</span><span class="evid">EVID<span class="tick" aria-hidden="true">✓</span></span></span>' : '');
    card.appendChild(header); card.appendChild(body); card.appendChild(brand);
    return card;
  }

  function renderPurchaseCard(p){
    var card=document.createElement("div"); card.className="card purchase-card enter";
    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click", function(){
      // --- Dismiss persistence (new)
      handleDismiss();
      clearShowTimers();
      card.classList.remove("enter");
      card.classList.add("leave");
      setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 360);
    });
    card.appendChild(x);

    var top=document.createElement("div"); top.className="p-top";
    var textCol=document.createElement("div"); textCol.className="ptext";

    var tTop=document.createElement("div"); tTop.className="ptime-top";
    tTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
                   + '  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>'
                   + '  <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
                   + '</svg>' + escapeHTML(timeAgo(p.purchased_at));
    textCol.appendChild(tTop);

    var sentence=document.createElement("div"); sentence.className="psentence";
    var buyerFirst = firstName(p.buyer);
    sentence.innerHTML = '<strong class="buyer">'+escapeHTML(buyerFirst)+'</strong> רכש/ה '
                       + '<span class="prod">'+escapeHTML(p.product)+'</span>';
    textCol.appendChild(sentence);

    var media=document.createElement("div"); media.className="pmedia";
    var frame=document.createElement("div"); frame.className="pframe";
    var imgEl;
    function fb(){ var d=document.createElement("div"); d.className="pimg-fallback"; d.textContent="✓"; return d; }
    function swap(el){ if(imgEl && imgEl.parentNode){ imgEl.parentNode.replaceChild(el, imgEl);} imgEl = el; }
    if (p.image) {
      var pre = new Image(); pre.decoding="async"; pre.loading="eager";
      pre.onload = function(){ var tag=document.createElement("img"); tag.className="pimg"; tag.alt=""; tag.src = p.image; swap(tag); };
      pre.onerror = function(){ swap(fb()); };
      pre.src = p.image; imgEl = fb();
    } else { imgEl = fb(); }
    frame.appendChild(imgEl);
    media.appendChild(frame);

    var hotcap = document.createElement('div'); hotcap.className = 'hotcap';
    hotcap.innerHTML = '<span class="badge-hot pulse" role="status" aria-live="polite">'
      + '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
      + '  <path d="M13 2.5C13 4.3 12.2 5.7 11.1 7 10 8.4 9 9.8 9 11.8A4 4 0 0 0 13 16a4 4 0 0 0 4-4c0-2.5-1.3-4-2.4-5.3C13.4 5.3 13 4.3 13 2.5zM11 3.2C9 5 7 7.9 7 11.3 7 15.4 9.9 18 13 18s6-2.6 6-6.7c0-3.2-1.7-5.4-3.3-7.4.3 1.3.2 2.7-.4 3.8C14.6 7 14 5.6 14 3.7 13.2 3.1 12.2 2.7 11 3.2z"></path>'
      + '</svg>'
      + 'פופולרי עכשיו</span>';
    media.appendChild(hotcap);

    top.appendChild(textCol);
    top.appendChild(media);
    card.appendChild(top);
    return card;
  }

  function showNext(overrideShowMs){
    if(!items.length) return;
    if(isDismissed) return; // stop if user dismissed on this page

    clearShowTimers();
    isPausedForReadMore = false;
    remainingShowMs = 0;

    var itm = items[idx % items.length];
    var shownIndex = idx % items.length; // about to show this one
    idx++;

    // sticky review on mobile (purchases not sticky)
    if (itm.kind === "review") wrap.classList.add('sticky-review'); else wrap.classList.remove('sticky-review');

    warmForItem(itm).then(function(){
      if(isDismissed) return; // re-check after preload
      var card = (itm.kind==="purchase") ? renderPurchaseCard(itm.data) : renderReviewCard(itm.data);
      wrap.innerHTML=""; 
      wrap.appendChild(card);
      currentCard = card;

      if(itm.kind === "review" && typeof card._setupReadMore === "function"){
        card._setupReadMore();
      }

      // persist "start of show" timestamp and index (also clears any prior manualClose/snooze)
      saveState(shownIndex, itemsSig);

      var showFor = Math.max(300, Number(overrideShowMs||SHOW_MS));
      scheduleHide(showFor);
    });
  }

  function startFrom(beginDelayMs){
    if(loop) clearInterval(loop);
    if(preTimer) clearTimeout(preTimer);
    if(isDismissed) return;

    var cycle = SHOW_MS + GAP_MS;

    function beginInterval(){
      if(isDismissed) return;
      showNext();
      loop = setInterval(function(){ if(!isDismissed) showNext(); }, cycle);
    }

    if (beginDelayMs && beginDelayMs > 0){
      preTimer = setTimeout(beginInterval, beginDelayMs);
    } else {
      beginInterval();
    }
  }

  // --- Dismiss persistence: central handler for ✕ clicks
  function handleDismiss(){
    try{
      isDismissed = true;
      if(loop) clearInterval(loop);
      if(preTimer) clearTimeout(preTimer);
      clearShowTimers();
      isPausedForReadMore = false;

      // compute the index of the CURRENTLY displayed item
      var current = (idx - 1 + (items.length*2)) % (items.length||1);
      var until = Date.now() + DISMISS_COOLDOWN_MS;

      // save index + snooze markers; next page will honor this
      saveState(current, itemsSig, { manualClose: true, snoozeUntil: until });
    }catch(_){}
  }

  /* ---- data loading ---- */
  function loadAll(){
    var p1 = REVIEWS_EP ? fetchJSON(REVIEWS_EP).then(function(d){ var a=normalizeArray(d,"review"); log("reviews:", a.length); return a; }).catch(function(e){ console.warn("reviews fetch err:", e); return []; }) : Promise.resolve([]);
    var p2 = PURCHASES_EP ? fetchJSON(PURCHASES_EP).then(function(d){ var a=normalizeArray(d,"purchase"); log("purchases:", a.length); return a; }).catch(function(e){ console.warn("purchases fetch err:", e); return []; }) : Promise.resolve([]);

    Promise.all([p1,p2]).then(function(r){
      var rev = r[0]||[], pur = r[1]||[];

      // skip reviews without any text
      rev = rev.filter(function(v){
        return normalizeSpaces(v.text).length > 0;
      });

      // prewarm images early
      rev.forEach(function(v){ if(v.profilePhotoUrl) warmImage(v.profilePhotoUrl); });
      pur.forEach(function(v){ if(v.image) warmImage(v.image); });

      // interleave and sign
      items = interleave(rev, pur);
      itemsSig = itemsSignature(items);
      log("total items:", items.length);

      if(!items.length){
        root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">No items to display.</div>';
        return;
      }

      ensureAssistantInHead().then(function(){
        wrap.classList.add('ready'); // reveal only after Assistant is ready

        var state = restoreState();
        var cycle = SHOW_MS + GAP_MS;
        var now = Date.now();

        // --- Dismiss persistence on new page
        if (state && state.sig === itemsSig && state.manualClose) {
          var snoozeUntil = Number(state.snoozeUntil||0);
          // continue from the same point → start with the NEXT item after the dismissed one
          idx = ((Number(state.idx||0) + 1) % items.length + items.length) % items.length;

          if (snoozeUntil > now) {
            // wait out remaining cooldown, then start
            var wait = snoozeUntil - now;
            startFrom(wait);
            return;
          } else {
            // cooldown over, start immediately
            startFrom(0);
            return;
          }
        }

        // --- Normal resume logic (unchanged)
        if (state && state.sig === itemsSig) {
          var elapsed = Math.max(0, now - Number(state.shownAt||0));
          var step = Math.floor(elapsed / cycle);
          var elapsedInCycle = elapsed % cycle;

          if (elapsedInCycle < SHOW_MS){
            // still in show window → resume that card until it finishes
            idx = (Number(state.idx||0) + step) % items.length;
            var remainingShow = SHOW_MS - elapsedInCycle;

            showNext(remainingShow);

            preTimer = setTimeout(function(){
              startFrom(0);
            }, remainingShow + GAP_MS);

          } else {
            // in the gap → next card after remaining gap
            idx = (Number(state.idx||0) + step + 1) % items.length;
            var remainingGap = cycle - elapsedInCycle;
            startFrom(remainingGap);
          }
        } else {
          if (INIT_MS > 0) setTimeout(function(){ startFrom(0); }, INIT_MS);
          else startFrom(0);
        }
      });
    })
    .catch(function(e){
      root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Widget error: '+ String(e && e.message || e) +'</div>';
      console.error("[both-controller v3.6.4]", e);
    });
  }

  // Fixed: only update index on unload; keep original shownAt intact (and keep any manualClose/snooze)
  window.addEventListener('beforeunload', function(){
    try {
      if (!items.length) return;
      var lastShown = (idx - 1 + items.length*2) % (items.length||1);
      updateIndexOnly(lastShown, itemsSig);
    } catch(_) {}
  });

  /* ---- go ---- */
  loadAll();
})();
