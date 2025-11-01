// purchase-widget v1.0.0 — ES5-safe, 15s show / 6s gap, 5s init delay
(function () {
  var hostEl = document.getElementById("purchases-widget");
  if (!hostEl) return;

  var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
  var scripts = document.scripts;
  var scriptEl = document.currentScript || scripts[scripts.length - 1];

  var endpoint     = scriptEl && scriptEl.getAttribute("data-endpoint");
  var SHOW_MS      = Number((scriptEl && scriptEl.getAttribute("data-show-ms")) || 15000);
  var GAP_MS       = Number((scriptEl && scriptEl.getAttribute("data-gap-ms"))  || 6000);
  var INIT_DELAYMS = Number((scriptEl && scriptEl.getAttribute("data-init-delay-ms")) || 5000);
  var FADE_MS      = 350;

  if (!endpoint) {
    root.innerHTML = '<div style="font-family:system-ui;color:#c00;background:#fff3f3;padding:12px;border:1px solid #f7caca;border-radius:8px">Missing <code>data-endpoint</code> on purchases widget.</div>';
    return;
  }

  var style = document.createElement("style");
  style.textContent = ''
    + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
    + ':host{all:initial;}'
    + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;}'
    + '.card{width:320px;max-width:88vw;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.06);overflow:hidden;direction:rtl;}'
    + '.row{display:grid;grid-template-columns:56px 1fr 24px;gap:10px;align-items:center;padding:12px 12px 8px;}'
    + '.thumb{width:56px;height:56px;border-radius:10px;object-fit:cover;background:#eee;display:block;}'
    + '.meta{display:flex;flex-direction:column;gap:4px;}'
    + '.line1{font-weight:700;font-size:14px;line-height:1.2;}'
    + '.line2{font-size:13px;opacity:.9;}'
    + '.close{appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;}'
    + '.close:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;}'
    + '.fade-in{animation:fadeIn .35s ease forwards;}'
    + '.fade-out{animation:fadeOut .35s ease forwards;}'
    + '@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}'
    + '@keyframes fadeOut{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(8px);}}';
  root.appendChild(style);

  var wrap = document.createElement("div"); wrap.className = "wrap"; root.appendChild(wrap);

  function txt(x){ return (x==null?"":String(x)).trim(); }
  function trunc(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function img(url){ var i=document.createElement("img"); i.className="thumb"; i.alt=""; i.width=56; i.height=56; i.decoding="async"; i.loading="eager"; if(url) i.src=url; return i; }
  function relTime(iso){
    var now=Date.now(), t=iso?Date.parse(iso):NaN; if(!isFinite(t)) return "הרגע";
    var s=Math.max(1, Math.round((now - t)/1000));
    if (s < 45) return "הרגע"; if (s < 90) return "לפני דקה";
    var m = Math.round(s/60); if (m < 45) return "לפני " + m + " דקות";
    if (m < 90) return "לפני שעה";
    var h = Math.round(m/60); if (h < 24) return "לפני " + h + " שעות";
    if (h < 48) return "אתמול";
    var d = Math.round(h/24); if (d < 7) return "לפני " + d + " ימים";
    var w = Math.round(d/7); if (w < 4) return "לפני " + w + " שבועות";
    var mo = Math.round(d/30); if (mo < 12) return "לפני " + mo + " חודשים";
    var y = Math.round(d/365); return "לפני " + y + " שנים";
  }

  function normalize(arr){
    if (Object.prototype.toString.call(arr) !== "[object Array]") return [];
    var out=[]; for (var i=0;i<arr.length;i++){
      var x = arr[i]||{};
      var buyer = txt(x.buyer||x.customer||x.name); var product = txt(x.product||x.title||x.item);
      if (!buyer || !product) continue;
      out.push({ buyer: buyer, product: product, image: txt(x.image||x.imageUrl||""), time: txt(x.purchased_at||x.time||"") });
    }
    return out;
  }

  function card(p){
    var c=document.createElement("div"); c.className="card fade-in";
    var row=document.createElement("div"); row.className="row";
    var t=img(p.image);
    var meta=document.createElement("div"); meta.className="meta";
    var l1=document.createElement("div"); l1.className="line1";
    l1.textContent = (p.buyer||"לקוח")+" קנה "+trunc(p.product,6)+" "+relTime(p.time);
    var l2=document.createElement("div"); l2.className="line2"; l2.textContent = trunc(p.product, 10);
    meta.appendChild(l1); meta.appendChild(l2);
    var x=document.createElement("button"); x.className="close"; x.setAttribute("aria-label","סגור"); x.textContent="×";
    x.addEventListener("click",function(){ c.classList.remove("fade-in"); c.classList.add("fade-out"); setTimeout(function(){ c.remove(); if(loop){ clearInterval(loop); loop=null; } }, 350); });
    row.appendChild(t); row.appendChild(meta); row.appendChild(x);
    c.appendChild(row);
    return c;
  }

  var items=[], idx=0, loop=null;

  function show(){
    if(!items.length) return;
    var el=card(items[idx % items.length]); idx++;
    wrap.innerHTML=""; wrap.appendChild(el);
    setTimeout(function(){ el.classList.remove("fade-in"); el.classList.add("fade-out"); }, Math.max(0, SHOW_MS-350));
    setTimeout(function(){ if(el && el.parentNode){ el.parentNode.removeChild(el); } }, SHOW_MS);
  }

  var t0=Date.now();
  fetch(endpoint,{method:"GET",credentials:"omit",cache:"no-store"})
    .then(function(r){ return r.json(); })
    .then(function(data){
      items = normalize(data);
      if(!items.length) items=[{buyer:"לקוח",product:"מוצר",time:new Date().toISOString(),image:""}];
      var wait=Math.max(0, INIT_DELAYMS - (Date.now()-t0));
      setTimeout(function(){ idx=0; show(); if(loop) clearInterval(loop); loop=setInterval(show, SHOW_MS+GAP_MS); }, wait);
    })
    .catch(function(err){
      root.innerHTML='<div style="font-family:system-ui;color:#c00;background:#fff3f3;padding:12px;border:1px solid #f7caca;border-radius:8px">Widget error: '+(err&&err.message?err.message:String(err))+'</div>';
      console.error("[purchase-widget]", err);
    });
})();
