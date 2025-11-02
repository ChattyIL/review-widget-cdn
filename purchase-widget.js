/*! purchase-widget v3.3.2 — ES5-safe, product image on RIGHT, buyer inline, time in footer, no-referrer */
(function () {
  var hostEl = document.getElementById("purchases-widget") || document.getElementById("reviews-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  var endpoint   = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS    = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000);
  var GAP_MS     = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);
  var INIT_MS    = Number((scriptEl && scriptEl.getAttribute("data-init-delay-ms")) || 0);
  var DEBUG      = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");
  function log(){ if (DEBUG) { var a=["[purchase-widget v3.3.2]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!endpoint) {
    root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing <code>data-endpoint</code> on widget script.</div>';
    return;
  }

  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:rtl;}'
    + '.row{display:grid;grid-template-columns:1fr 74px 24px;gap:12px;align-items:center;padding:12px 12px 8px;}'
    + '.pimg{justify-self:end;width:74px;height:74px;border-radius:12px;object-fit:cover;background:#eef2f7;display:block;border:1px solid rgba(0,0,0,.06);}'
    + '.pimg-fallback{justify-self:end;width:74px;height:74px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#475569;}'
    + '.line{display:flex;flex-direction:column;gap:6px;align-items:flex-end;}'
    + '.sentence{font-weight:700;font-size:15px;line-height:1.25;text-align:right;}'
    + '.timebar{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:12.5px;color:#475569;direction:rtl;}'
    + '.xbtn{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
    + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;} .xbtn:active{transform:translateY(0);}'
    + '.fade-in{animation:fadeIn .35s ease forwards;} .fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}'
    + '@media (min-width:720px){ .row{grid-template-columns:1fr 86px 24px;} .pimg,.pimg-fallback{width:86px;height:86px;} .sentence{font-size:16px;} }'
    + '@media (max-width:480px){ .card{width:300px} .row{grid-template-columns:1fr 64px 22px;gap:10px;padding:10px 10px 6px} .pimg,.pimg-fallback{width:64px;height:64px} .sentence{font-size:14px;line-height:1.2} .timebar{font-size:11.5px;padding:8px 10px} }'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div"); wrap.className = "wrap"; root.appendChild(wrap);

  function timeAgo(ts){ try{ var d=new Date(ts); var diff=Math.max(0,(Date.now()-d.getTime())/1000); var m=Math.floor(diff/60), h=Math.floor(m/60), d2=Math.floor(h/24); if(d2>0) return d2===1?"אתמול":"לפני "+d2+" ימים"; if(h>0) return "לפני "+h+" שעות"; if(m>0) return "לפני "+m+" דקות"; return "כרגע"; }catch(_){ return ""; } }
  function pSentence(buyer, product){ return (buyer||"לקוח/ה") + " רכש/ה " + (product||"מוצר"); }

  function normalize(data){
    var arr=[]; if(Object.prototype.toString.call(data)==="[object Array]") arr=data;
    else if(data&&typeof data==="object"){ if(Object.prototype.toString.call(data.items)==="[object Array]") arr=data.items; else if(Object.prototype.toString.call(data.data)==="[object Array]") arr=data.data; else if(Object.prototype.toString.call(data.results)==="[object Array]") arr=data.results; else if(Object.prototype.toString.call(data.records)==="[object Array]") arr=data.records; }
    return arr.map(function(x){ return { buyer:String(x.buyer||x.buyerName||x.customerName||x.name||x.customer||"לקוח/ה"), product:String(x.product||x.productName||x.item||x.title||"מוצר"), image:String(x.image||""), purchased_at:x.purchased_at||new Date().toISOString() }; });
  }

  function renderCard(p){
    var card=document.createElement("div"); card.className="card fade-in";
    var row=document.createElement("div"); row.className="row";

    var textCol=document.createElement("div"); textCol.className="line";
    var sentence=document.createElement("div"); sentence.className="sentence";
    sentence.textContent = pSentence(p.buyer, p.product);
    textCol.appendChild(sentence);

    var imgEl = fallbackBox();
    if (p.image) {
      var pre = new Image();
      pre.decoding="async"; pre.loading="eager";
      pre.onload=function(){ var tag=document.createElement("img"); tag.className="pimg"; tag.alt=""; tag.src=p.image; tag.referrerPolicy="no-referrer"; imgEl.parentNode && imgEl.parentNode.replaceChild(tag,imgEl); imgEl=tag; };
      pre.onerror=function(){ /* keep fallback */ };
      pre.src=p.image;
    }
    function fallbackBox(){ var d=document.createElement("div"); d.className="pimg-fallback"; d.textContent="✓"; return d; }

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","סגירה"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ card.remove(); if(loop){ clearInterval(loop); loop=null; } }, 350); });

    row.appendChild(textCol); row.appendChild(imgEl); row.appendChild(x);

    var footer=document.createElement("div"); footer.className="timebar"; footer.textContent = timeAgo(p.purchased_at);

    card.appendChild(row); card.appendChild(footer);
    return card;
  }

  var items=[]; var i=0; var loop=null;
  function show(){ if(!items.length) return; var card=renderCard(items[i % items.length]); i++; wrap.innerHTML=""; wrap.appendChild(card); setTimeout(function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); }, Math.max(0, SHOW_MS-350)); setTimeout(function(){ if(card && card.parentNode){ card.parentNode.removeChild(card); } }, SHOW_MS); }
  function start(){ if(loop) clearInterval(loop); show(); loop=setInterval(show, SHOW_MS + GAP_MS); }

  function fetchText(url){ return fetch(url,{method:"GET",credentials:"omit",cache:"no-store"}).then(function(res){ return res.text().then(function(raw){ if(!res.ok) throw new Error(raw || ("HTTP "+res.status)); return raw; }); }); }
  function fetchJSON(url){ return fetchText(url).then(function(raw){ try{ return JSON.parse(raw);}catch(_){ return {items:[]}; } }); }

  var t0 = Date.now();
  function boot(){ fetchJSON(endpoint).then(function(data){ items = normalize(data).filter(function(x){ return x && (x.buyer || x.product); }); if(!items.length) throw new Error("No purchases"); var elapsed=Date.now()-t0, wait=Math.max(0, INIT_MS - elapsed); setTimeout(start, wait); }).catch(function(err){ log("purchase load err:", err); }); }
  if (INIT_MS > 0) setTimeout(boot, INIT_MS); else boot();
})();
