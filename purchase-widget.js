/*! purchase-widget v1.2 — ES5-safe, desktop-larger image, centered sentence, time footer */
(function () {
  var hostEl = document.getElementById("purchases-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  // Config from embed
  var endpoint   = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS    = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000);
  var GAP_MS     = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);
  var INIT_DELAY = Number((scriptEl && scriptEl.getAttribute("data-init-ms")) || 5000);
  var FADE_MS    = 350;

  if (!endpoint) {
    root.innerHTML =
      '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  // Styles
  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{direction:rtl;width:340px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;}'
    + '.row{display:grid;grid-template-columns:1fr 64px 24px;gap:12px;align-items:center;padding:12px 12px 8px;}'
    + '.img{justify-self:end;width:64px;height:64px;border-radius:10px;object-fit:cover;background:#eee;display:block;}'
    + '.img-fallback{justify-self:end;width:64px;height:64px;border-radius:10px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#475569;}'
    + '.line1{font-weight:700;font-size:14px;line-height:1.2;text-align:center;}'
    + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;opacity:.95;}'
    + '.time{margin-inline-start:auto;color:#475569}'
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.fade-in{animation:fadeIn .35s ease forwards;}'
    + '.fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'
    // Desktop: larger product image
    + '@media (min-width: 720px){ .row{grid-template-columns:1fr 80px 24px;} .img,.img-fallback{width:80px;height:80px;} .line1{font-size:15px;} }'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // Utils
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
  function imgOrFallback(url){
    if(url){
      var im=document.createElement("img");
      im.className="img"; im.alt=""; im.decoding="async"; im.loading="eager"; im.src=url;
      im.addEventListener("error",function(){ im.replaceWith(fallback()); });
      return im;
    }
    function fallback(){
      var d=document.createElement("div");
      d.className="img-fallback"; d.textContent="✓";
      return d;
    }
    return fallback();
  }

  function normalize(data){
    var arr=[]; if(Object.prototype.toString.call(data)==="[object Array]") arr=data;
    else if(data&&typeof data==="object"){ if(Object.prototype.toString.call(data.items)==="[object Array]") arr=data.items; }
    return arr.map(function(x){
      return {
        buyer: String(x.buyer||"לקוח/ה"),
        product: String(x.product||"מוצר"),
        image: String(x.image||""),
        purchased_at: x.purchased_at || new Date().toISOString()
      };
    });
  }

  function sentence(buyer, product){
    // Example: "נועה רכשה תמונת קנבס"
    // Keep buyer as-is; verb is gender-neutral enough for demo UI
    return (buyer||"לקוח/ה") + " " + "רכש/ה" + " " + (product||"מוצר");
  }

  function renderCard(p){
    var card=document.createElement("div"); card.className="card fade-in";
    var header=document.createElement("div"); header.className="row";

    var text=document.createElement("div"); text.className="line1";
    text.textContent = sentence(p.buyer, p.product);

    var pic=imgOrFallback(p.image);

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","סגירה"); x.textContent="×";
    x.addEventListener("click",function(){
      card.classList.remove("fade-in"); card.classList.add("fade-out");
      setTimeout(function(){ card.remove(); if(loop){ clearInterval(loop); loop=null; } }, FADE_MS);
    });

    // NOTE: grid columns are [ text | image | x ]
    header.appendChild(text); header.appendChild(pic); header.appendChild(x);

    var brand=document.createElement("div"); brand.className="brand";
    var time=document.createElement("span"); time.className="time";
    time.textContent = timeAgo(p.purchased_at);
    brand.appendChild(time);

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

  function start(){
    if(loop) clearInterval(loop);
    show(); loop=setInterval(show, SHOW_MS + GAP_MS);
  }

  // Fetch + boot
  setTimeout(function(){
    fetch(endpoint,{method:"GET",credentials:"omit",cache:"no-store"})
      .then(function(res){ return res.json(); })
      .then(function(data){
        items = normalize(data).filter(function(x){ return x && (x.buyer || x.product); });
        if(!items.length) throw new Error("No purchases");
        start();
      })
      .catch(function(_err){ /* silent if none */ });
  }, INIT_DELAY);
})();
