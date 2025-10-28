<script>
// review-widget v1.9.2 — ES5-safe, rotating cards, golden stars, 20-word cap
// Built-in tiny text badge "מאומת EVID ✓" (no extra embed attributes needed)
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  // Config from embed (endpoint is required)
  var endpoint = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS  = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000); // default 15s
  var GAP_MS   = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);  // default 6s
  var FADE_MS  = 350;
  var DEBUG    = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");

  function log(){ if (DEBUG) { var a=["[reviews-widget v1.9.2]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Styles (inside Shadow DOM)
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:auto;}'
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:center;padding:12px 12px 8px;}'
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;display:block;}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;}'
    + '.body.small{font-size:12.5px;}'
    + '.body.tiny{font-size:11.5px;}'
    /* bottom brand row (Google G + ★★★★★ + tiny badge) */
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.95;}'
    + '.gmark{display:flex;align-items:center;}'
    + '.gstars{font-size:13px;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}'
    + '.badgeText{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9;}'
    + '.badgeText .verified{color:#444;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;font-weight:600;}'
    + '.badgeText .evid{color:#000;font-weight:700;display:inline-flex;align-items:center;gap:4px;}'
    + '.badgeText .tick{font-size:12px;line-height:1;}'
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.xbtn:active{transform:translateY(0);}'
    + '.stars{display:none!important;}' /* hide old under-name stars */
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
  function mkStars(n){ n=Math.max(0,Math.min(5,Math.round(Number(n)||0))); for(var i=0,a=[];i<5;i++) a.push(i<n?"★":"☆"); return a.join(" "); }
  function scaleClass(t){ t=(t||"").trim(); var L=t.length; if(L>220) return "tiny"; if(L>140) return "small"; return ""; }
  function truncateWords(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }

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
    return arr.map(function(x){
      return {
        authorName: x.authorName||x.userName||x.Header||x.name||x.author||"Anonymous",
        text:       x.text||x.reviewText||x.Content||x.content||"",
        rating:     x.rating||x.stars||x.score||5,
        profilePhotoUrl: x.Photo||x.reviewerPhotoUrl||getPhotoUrl(x)
      };
    });
  }

  function renderMonogram(name){
    var d=document.createElement("div");
    d.className="avatar-fallback";
    d.textContent=firstLetter(name);
    d.style.background=colorFromString(name);
    return d;
  }

  function renderAvatar(name,url){
    if(url){
      var img=document.createElement("img");
      img.className="avatar"; img.alt=""; img.width=40; img.height=40;
      img.decoding="async"; img.loading="eager"; img.src=url;
      img.addEventListener("error",function(){ img.replaceWith(renderMonogram(name)); });
      return img;
    }
    return renderMonogram(name);
  }

  function renderCard(r){
    var card=document.createElement("div"); card.className="card fade-in";

    var header=document.createElement("div"); header.className="row";
    var avatarEl=renderAvatar(r.authorName, r.profilePhotoUrl||r.reviewerPhotoUrl||r.Photo);

    var meta=document.createElement("div"); meta.className="meta";
    var name=document.createElement("div"); name.className="name";
    name.textContent=r.authorName||"Anonymous"; meta.appendChild(name);

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){
      card.classList.remove("fade-in");
      card.classList.add("fade-out");
      setTimeout(function(){
        card.remove();
        if(loop){ clearInterval(loop); loop=null; }
      }, FADE_MS);
    });

    header.appendChild(avatarEl); header.appendChild(meta); header.appendChild(x);

    var body=document.createElement("div");
    var fullText=r.text||r.content||""; var shortText=truncateWords(fullText,20);
    body.className="body "+scaleClass(shortText); body.textContent=shortText;

    var brand=document.createElement("div"); brand.className="brand";
    brand.innerHTML =
        '<span class="gmark" aria-label="Google">'
      + '  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
      + '    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.23 1.26-.93 2.33-1.98 3.04v2.52h3.2c1.87-1.72 2.95-4.25 2.95-7.27 0-.7-.06-1.37-.17-2.01z"></path>'
      + '    <path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36l-3.2-2.52c-.89.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56A9.818 9.818 0 0 0 12.18 22z"></path>'
      + '    <path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82V7.64H3.4a9.82 9.82 0 0 0 0 8.72"></path>'
      + '    <path fill="#EA4335" d="M12.18 5.5c1.45 0 2.75.5 3.77 1.48l2.82-2.82A9.36 9.36 0 0 0 12.18 2c-3.78 0-7.01 2.17-8.78 5.64"></path>'
      + '  </svg>'
      + '</span>'
      + '<span class="gstars" aria-label="5 star rating">★ ★ ★ ★ ★</span>'
      + '<span class="badgeText" aria-label="Verified by Evid">'
      +   '<span class="verified">מאומת</span>'
      +   '<span class="evid">EVID<span class="tick" aria-hidden="true">✓</span></span>'
      + '</span>';

    card.appendChild(header); card.appendChild(body); card.appendChild(brand);
    return card;
  }

  // Rotation
  var reviews=[]; var i=0; var loop=null;

  function show(){
    if(!reviews.length) return;
    var card=renderCard(reviews[i % reviews.length]); i++;
    wrap.innerHTML=""; wrap.appendChild(card);

    // fade-out just before end of SHOW_MS, then remove so the GAP_MS is a clean break
    setTimeout(function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); }, Math.max(0, SHOW_MS - FADE_MS));
    setTimeout(function(){ if(card && card.parentNode){ card.parentNode.removeChild(card); } }, SHOW_MS);
  }

  // Fetch + start
  fetch(endpoint,{method:"GET",credentials:"omit",cache:"no-store"})
    .then(function(res){
      return res.text().then(function(raw){
        if(!res.ok) throw new Error(raw || ("HTTP "+res.status));
        try{ return JSON.parse(raw);}catch(_){ return {reviews:[{text:raw}]}; }
      });
    })
    .then(function(data){
      reviews=normalize(data); log("fetched reviews:",reviews.length);
      if(!reviews.length) throw new Error("No reviews returned");
      i=0; show(); if(loop) clearInterval(loop); loop=setInterval(show, SHOW_MS + GAP_MS);
    })
    .catch(function(err){
      root.innerHTML =
        '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">'
        + 'Widget error: ' + (err && err.message ? err.message : String(err)) + '</div>';
      console.error("[reviews-widget v1.9.2]", err);
    });
})();
</script>
