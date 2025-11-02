// review-widget v2.5.0 — ES5-safe, no-blank-avatars, mobile-compact
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  var endpoint      = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS       = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000);
  var GAP_MS        = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);
  var INIT_DELAY_MS = Number((scriptEl && scriptEl.getAttribute("data-init-delay-ms")) || 5000);
  var MAX_WORDS     = Number((scriptEl && scriptEl.getAttribute("data-max-words")) || 20);
  var FADE_MS       = 350;
  var DEBUG         = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");

  function log(){ if (DEBUG) { var a=["[reviews-widget v2.5.0]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Styles (Shadow DOM)
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:auto;}'
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:center;padding:12px 12px 8px;}'
    + '.avatar-slot{width:40px;height:40px;border-radius:50%;overflow:hidden;display:block;background:#eee;}'
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;display:block;}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;font-size:14px;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;}'
    + '.body.small{font-size:12.5px;}'
    + '.body.tiny{font-size:11.5px;}'
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.95;}'
    + '.gmark{display:flex;align-items:center;height:16px;} .gmark svg{display:block;}'
    + '.gstars{font-size:13px;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}'
    + '.badgeText{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9;}'
    + '.badgeText .verified{color:#444;font-weight:600;}'
    + '.badgeText .evid{color:#000;font-weight:700;display:inline-flex;align-items:center;gap:4px;}'
    + '.badgeText .tick{font-size:12px;line-height:1;}'
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.xbtn:active{transform:translateY(0);}'
    + '.stars{display:none!important;}'
    + '.fade-in{animation:fadeIn .35s ease forwards;}'
    + '.fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'
  
    // Mobile compact height — match reviews
+ '@media (max-width:480px){ .card{width:300px} .row{grid-template-columns:34px 1fr 22px;gap:8px;padding:10px 10px 6px} .avatar,.avatar-fallback{width:34px;height:34px} .name{font-size:13px} .subtitle{display:none} .body{font-size:13px;line-height:1.3;padding:0 10px 10px} .badgeText{font-size:11px} .gstars{font-size:12px} }'
    + '}'
    
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Helpers
  function scaleClass(t){ t=(t||"").trim(); var L=t.length; if(L>220) return "tiny"; if(L>140) return "small"; return ""; }
  function truncateWords(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }

  // Avatar: show monogram immediately, swap in image only after it loads
  function renderAvatar(name,url){
  var shell = (function(){
    var d=document.createElement("div");
    d.className="avatar-fallback";
    d.textContent=(name||"?").trim().charAt(0).toUpperCase()||"?";
    // simple color
    var s=name||"", h=0; for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    d.style.background="hsl("+(h%360)+" 70% 45%)";
    return d;
  })();
  if(url){
    var pre = new Image();
    pre.width=40; pre.height=40; pre.decoding="async"; pre.loading="eager";
    pre.onload=function(){
      var img=document.createElement("img");
      img.className="avatar"; img.alt=""; img.width=40; img.height=40; img.decoding="async"; img.loading="eager"; img.src=url;
      shell.replaceWith(img);
    };
    pre.onerror=function(){ /* keep monogram */ };
    pre.src=url;
  }
  return shell;
}


  // Prewarm a few upcoming avatar URLs to reduce flashes
  function prefetchUrls(arr){
    for (var i=0;i<Math.min(arr.length,6);i++){
      var u = arr[i]; if(!u) continue;
      var im = new Image(); im.decoding="async"; im.loading="eager"; im.src = u;
    }
  }

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

  function normalize(data){
    var arr=[];
    if(Object.prototype.toString.call(data)==="[object Array]") arr=data;
    else if(data&&typeof data==="object"){
      if(Object.prototype.toString.call(data.reviews)==="[object Array]") arr=data.reviews;
      else if(data.reviews&&Object.prototype.toString.call(data.reviews.items)==="[object Array]") arr=data.reviews.items;
      else if(Object.prototype.toString.call(data.items)==="[object Array]") arr=data.items;
      else if(Object.prototype.toString.call(data.data)==="[object Array]") arr=data.data;
      else if(Object.prototype.toString.call(data.results)==="[object Array]") arr=data.results;
      else if(Object.prototype.toString.call(data.records)==="[object Array]") arr=data.records;
      else if(data.text||data.Content||data.reviewText||data.content) arr=[data];
    }

    var cleaned = [];
    for (var i=0;i<arr.length;i++){
      var x = arr[i] || {};
      var raw = (x.text||x.reviewText||x.Content||x.content||"").trim();
      if (!raw) continue;

      cleaned.push({
        authorName: x.authorName||x.userName||x.Header||x.name||x.author||"Anonymous",
        text:       raw,
        rating:     x.rating||x.stars||x.score||5,
        profilePhotoUrl: x.Photo||x.reviewerPhotoUrl||getPhotoUrl(x)
      });
    }
    return cleaned;
  }

  function renderCard(r){
    var card=document.createElement("div"); card.className="card fade-in";

    var header=document.createElement("div"); header.className="row";
    var avatarEl=renderAvatarLazy(r.authorName, r.profilePhotoUrl||r.reviewerPhotoUrl||r.Photo);

    var meta=document.createElement("div"); meta.className="meta";
    var name=document.createElement("div"); name.className="name";
    name.textContent=r.authorName||"Anonymous"; meta.appendChild(name);

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(function(){ card.remove(); if(loop){ clearInterval(loop); loop=null; } }, FADE_MS);
    });

    header.appendChild(avatarEl); header.appendChild(meta); header.appendChild(x);

    var body=document.createElement("div");
    var shortText=truncateWords(r.text, MAX_WORDS);
    body.className="body "+scaleClass(shortText); body.textContent=shortText;

    var brand=document.createElement("div"); brand.className="brand";
    brand.innerHTML =
      '<span class="gmark" aria-label="Google">'
    + '  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
    + '    <path fill="#4285F4" d="M21.35 11.1H12v2.98h5.55c-.24 1.26-.95 2.33-2.01 3.04v2.52h3.2c1.9-1.72 2.99-4.25 2.99-7.27 0-.7-.06-1.37-.18-2.01z"></path>'
    + '    <path fill="#34A853" d="M12 22c2.67 0 4.9-.88 6.54-2.36l-3.2-2.52c-.9.6-2.04.95-3.34.95-2.56 0-4.73-1.73-5.5-4.05H3.4v2.56C5.14 20.65 8.32 22 12 22z"></path>'
    + '    <path fill="#FBBC05" d="M6.5 14.02c-.18-.55-.28-1.14-.28-1.74s.1-1.19.28-1.74V7.64H3.4a9.99 9.99 0 0 0 0 8.72h3.1V14.02z"></path>'
    + '    <path fill="#EA4335" d="M12 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12 2C8.22 2 5 4.17 3.22 7.64l3.1 2.56C7.1 7.88 9.26 5.5 12 5.5z"></path>'
    + '  </svg>'
    + '</span>'
    + '<span class="gstars" aria-label="5 star rating">★ ★ ★ ★ ★</span>'
    + '<span class="badgeText" aria-label="Verified by Evid"><span class="verified">מאומת</span><span class="evid">EVID<span class="tick" aria-hidden="true">✓</span></span></span>';

    card.appendChild(header); card.appendChild(body); card.appendChild(brand);
    return card;
  }

  var reviews=[]; var i=0; var loop=null;

  function show(){
    if(!reviews.length) return;
    var card=renderCard(reviews[i % reviews.length]); i++;
    wrap.innerHTML=""; wrap.appendChild(card);

    setTimeout(function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); }, Math.max(0, SHOW_MS - FADE_MS));
    setTimeout(function(){ if(card && card.parentNode){ card.parentNode.removeChild(card); } }, SHOW_MS);
  }

  var t0 = Date.now();
  fetch(endpoint,{method:"GET",credentials:"omit",cache:"no-store"})
    .then(function(res){ return res.text().then(function(raw){ if(!res.ok) throw new Error(raw || ("HTTP "+res.status)); try{ return JSON.parse(raw);}catch(_){ return {reviews:[{text:raw}]}; } }); })
    .then(function(data){
      reviews=normalize(data);
      log("fetched reviews:",reviews.length);

      if(!reviews.length){
        reviews = [{ authorName: "Anonymous", text: "שמח שבחרתי בכם", rating: 5, profilePhotoUrl: "" }];
      }

      // Prewarm next avatars
      var urls=[]; for (var k=0;k<reviews.length;k++){ var u=reviews[k]&&reviews[k].profilePhotoUrl; if(u){ urls.push(u); } }
      prefetchUrls(urls);

      var elapsed = Date.now() - t0;
      var wait = Math.max(0, INIT_DELAY_MS - elapsed);

      setTimeout(function(){
        i=0; show();
        if(loop) clearInterval(loop);
        loop=setInterval(show, SHOW_MS + GAP_MS);
      }, wait);
    })
    .catch(function(err){
      root.innerHTML =
        '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">'
        + 'Widget error: ' + (err && err.message ? err.message : String(err)) + '</div>';
      console.error("[reviews-widget v2.5.0]", err);
    });
})();
