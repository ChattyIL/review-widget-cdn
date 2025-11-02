/*! purchase-widget v1.6.0 — ES5-safe. Product image, no name line, footer shows relative time. */
(function () {
  var hostEl = document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  // Config from embed
  var endpoint  = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS   = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000);
  var GAP_MS    = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);
  var INIT_MS   = Number((scriptEl && (scriptEl.getAttribute("data-init-delay-ms") || scriptEl.getAttribute("data-init-ms"))) || 5000);
  var MAX_WORDS = Number((scriptEl && scriptEl.getAttribute("data-max-words")) || 20);
  var DEBUG     = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");
  var FADE_MS   = 350;

  function log(){ if (DEBUG) { var a=["[purchase-widget v1.6.0]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // ===== Styles (matching review widget) =====
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:auto;}'
    + '.row{display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:center;padding:12px 12px 8px;}'
    + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;display:block;}'
    + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
    + '.prodimg{width:40px;height:40px;border-radius:10px;object-fit:cover;background:#eee;display:block;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.ptext{font-size:14px;line-height:1.2;}' /* sentence next to the image */
    + '.body{display:none;}' /* no second text block for purchases */
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.95;color:#475569;}'
    + '.timeago{white-space:nowrap;}'
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.xbtn:active{transform:translateY(0);}'
    + '.fade-in{animation:fadeIn .35s ease forwards;}'
    + '.fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // ===== Helpers =====
  function truncateWords(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }
  function timeAgo(ts){
    try{
      var d=new Date(ts); var diff=Math.max(0,(Date.now()-d.getTime())/1000);
      var m=Math.floor(diff/60), h=Math.floor(m/60), dd=Math.floor(h/24);
      if(dd>0) return dd===1?"אתמול":"לפני "+dd+" ימים";
      if(h>0)  return "לפני "+h+" שעות";
      if(m>0)  return "לפני "+m+" דקות";
      return "כרגע";
    }catch(_){ return ""; }
  }

  function getPhotoUrl(o){
    if(!o||typeof o!=="object") return "";
    var k=Object.keys(o);
    for(var i=0;i<k.length;i++){
      var n=k[i], ln=n.toLowerCase();
      if(ln==="photo"||ln==="reviewerphotourl"||ln==="profilephotourl"||ln==="profile_photo_url"||
         ln==="photourl"||ln==="image"||ln==="imageurl"||ln==="avatar"||ln==="avatarurl"){
        var v=(o[n]==null?"":String(o[n])).trim();
        if(v) return v;
      }
    }
    return "";
  }
  function getProductImage(o){
    if(!o||typeof o!=="object") return "";
    var keys=["productImage","product_image","productImageUrl","product_image_url","productPhotoUrl","productPhoto","image","imageUrl","image_url","picture","photoUrl","photo"];
    for(var i=0;i<keys.length;i++){ var k=keys[i]; if(o[k]!=null && String(o[k]).trim()) return String(o[k]).trim(); }
    if(o.product && typeof o.product==="object"){
      if(o.product.image) return String(o.product.image).trim();
      if(o.product.imageUrl) return String(o.product.imageUrl).trim();
    }
    return "";
  }

  function renderMonogram(name){ var d=document.createElement("div"); d.className="avatar-fallback"; d.textContent=firstLetter(name); d.style.background=colorFromString(name); return d; }
  function renderAvatar(name,url){
    if(url){
      var img=document.createElement("img");
      img.className="avatar"; img.alt=""; img.width=40; img.height=40; img.decoding="async"; img.loading="eager"; img.src=url;
      img.addEventListener("error",function(){ img.replaceWith(renderMonogram(name)); });
      return img;
    }
    return renderMonogram(name);
  }
  function renderProductImage(url, altKey){
    if(url){
      var im=document.createElement("img");
      im.className="prodimg"; im.alt=""; im.width=40; im.height=40; im.decoding="async"; im.loading="eager"; im.src=url;
      im.addEventListener("error",function(){ im.replaceWith(renderMonogram(String(altKey||""))); });
      return im;
    }
    return null;
  }

  // Normalize → {buyer, product, text, productImageUrl, profilePhotoUrl, purchased_at}
  function normalize(data){
    var arr=[];
    if(Object.prototype.toString.call(data)==="[object Array]") arr=data;
    else if(data&&typeof data==="object"){
      if(Object.prototype.toString.call(data.items)==="[object Array]")   arr=data.items;
      else if(Object.prototype.toString.call(data.data)==="[object Array]") arr=data.data;
      else if(Object.prototype.toString.call(data.results)==="[object Array]") arr=data.results;
      else if(Object.prototype.toString.call(data.records)==="[object Array]") arr=data.records;
      else if(data.productName||data.product||data.item||data.text||data.note) arr=[data];
    }
    return arr.map(function(x){
      var buyer   = x.buyerName||x.customerName||x.name||x.customer||x.buyer||"נועה"; // ← default buyer
      var product = x.productName||x.item||x.title||x.product||"מוצר";
      var text    = buyer + " רכשה " + product; // ← default sentence
      return {
        buyer: buyer,
        product: product,
        text: text,
        productImageUrl: getProductImage(x),
        profilePhotoUrl: x.Photo||x.avatar||getPhotoUrl(x),
        purchased_at: x.purchased_at||x.purchasedAt||x.ts||x.timestamp||x.time||x.date||new Date().toISOString()
      };
    });
  }

  function renderCard(p){
    var card=document.createElement("div"); card.className="card fade-in";
    var header=document.createElement("div"); header.className="row";

    var left = renderProductImage(p.productImageUrl, p.product) || renderAvatar(p.buyer, p.profilePhotoUrl);
    var meta=document.createElement("div"); meta.className="meta";
    var line=document.createElement("div"); line.className="ptext";
    var sentence = truncateWords(p.text, MAX_WORDS);
    line.textContent = sentence;

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","סגירה"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ card.remove(); if(loop){ clearInterval(loop); loop=null; } }, FADE_MS); });

    meta.appendChild(line);
    header.appendChild(left); header.appendChild(meta); header.appendChild(x);

    // footer shows only the relative time
    var brand=document.createElement("div"); brand.className="brand";
    var tm=document.createElement("span"); tm.className="timeago"; tm.textContent=timeAgo(p.purchased_at);
    brand.appendChild(tm);

    card.appendChild(header); card.appendChild(brand);
    return card;
  }

  // Rotation
  var items=[]; var i=0; var loop=null;
  function show(){
    if(!items.length) return;
    var card=renderCard(items[i % items.length]); i++;
    wrap.innerHTML=""; wrap.appendChild(card);
    setTimeout(function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); }, Math.max(0, SHOW_MS-FADE_MS));
    setTimeout(function(){ if(card && card.parentNode){ card.parentNode.removeChild(card); } }, SHOW_MS);
  }
  function start(){ if(loop) clearInterval(loop); show(); loop=setInterval(show, SHOW_MS + GAP_MS); }

  // Fetch + boot
  setTimeout(function(){
    fetch(endpoint,{method:"GET",credentials:"omit",cache:"no-store"})
      .then(function(res){ return res.text().then(function(raw){ if(!res.ok) throw new Error(raw || ("HTTP "+res.status)); try{ return JSON.parse(raw);}catch(_){ return {items:[{text:raw}]}; }}); })
      .then(function(data){
        items = normalize(data).filter(function(x){ return x && (x.text||"").trim(); });
        if(!items.length) throw new Error("No purchases");
        start();
      })
      .catch(function(_err){ /* silent if no purchases */ });
  }, Math.max(0, INIT_MS));
})();
