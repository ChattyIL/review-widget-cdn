/*! both-controller v3.6.4 — MOBILE: add 5px top/bottom, show time above sentence; footer hidden. Desktop unchanged. */
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
  var MAX_WORDS = Number((scriptEl && scriptEl.getAttribute("data-max-words"))     || 20);
  var DEBUG     = (((scriptEl && scriptEl.getAttribute("data-debug")) || "0") === "1");
  var BADGE     = (((scriptEl && scriptEl.getAttribute("data-badge")) || "1") === "1");
  function log(){ if (DEBUG) { var a=["[both-controller v3.6.4]"]; for (var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console,a);} }

  if (!REVIEWS_EP && !PURCHASES_EP) {
    root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Missing endpoints.</div>';
    return;
  }

  /* ========== styles ========== */
  var style = document.createElement("style");
  style.textContent = ''
  + '@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap");'
  + ':host{all:initial;}'
  + '.wrap{position:fixed;right:16px;left:auto;bottom:16px;z-index:2147483000;font-family:"Assistant",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}'
  + '.wrap *{font-family:inherit;box-sizing:border-box;}'

  /* Card */
  + '.card{position:relative;width:370px;max-width:92vw;background:#fff;color:#0b1220;border-radius:18px;box-shadow:0 16px 40px rgba(2,6,23,.18);border:1px solid rgba(2,6,23,.06);overflow:hidden;}'

  /* Close button */
  + '.xbtn{position:absolute;top:10px;left:10px;appearance:none;border:0;background:#eef2f7;color:#111827;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;transition:transform .15s ease,filter .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.06) inset;}'
  + '.xbtn:hover{filter:brightness(.96);transform:translateY(-1px);opacity:1;} .xbtn:active{transform:translateY(0);}'

  /* -------- Reviews (unchanged) -------- */
  + '.row-r{display:grid;grid-template-columns:40px 1fr 24px;gap:12px;align-items:center;padding:12px 12px 8px;direction:rtl;}'
  + '.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eef2f7;display:block;border:1px solid rgba(2,6,23,.06);}'
  + '.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;width:40px;height:40px;border-radius:50%;}'
  + '.meta{display:flex;flex-direction:column;gap:4px;}'
  + '.name{font-weight:700;font-size:14px;line-height:1.2;}'
  + '.body{padding:0 12px 12px;font-size:14px;line-height:1.35;direction:rtl;}'
  + '.body.small{font-size:12.5px;} .body.tiny{font-size:11.5px;}'
  + '.brand{display:flex;align-items:center;gap:8px;justify-content:flex-start;padding:10px 12px;border-top:1px solid rgba(2,6,23,.07);font-size:12px;opacity:.95;direction:rtl;}'
  + '.gmark{display:flex;align-items:center;}'
  + '.gstars{font-size:13px;letter-spacing:1px;color:#f5b50a;text-shadow:0 0 .5px rgba(0,0,0,.2);}'
  + '.badgeText{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9;}'
  + '.badgeText .verified{color:#444;font-weight:600;}'
  + '.badgeText .evid{color:#000;font-weight:700;display:inline-flex;align-items:center;gap:4px;}'
  + '.badgeText .tick{font-size:12px;line-height:1;}'

  /* -------- Purchases (compact baseline) -------- */
  + '.p-top{display:grid;grid-template-columns:1fr 168px;gap:12px;align-items:center;padding:8px 12px 2px;direction:ltr;}'
  + '.ptext{grid-column:1;display:flex;flex-direction:column;gap:4px;align-items:stretch;direction:rtl;}'
  + '.ptime-top{display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:12.5px;color:#1f2937;opacity:.92;text-align:right;direction:rtl;margin:0;}'
  + '.ptime-top svg{width:14px;height:14px;opacity:.95;display:block;}'
  + '.psentence{max-width:100%;text-align:right;font-size:15px;line-height:1.35;margin:0;word-break:break-word;}'
  + '.psentence .buyer{font-weight:700;}'
  + '.psentence .prod{font-weight:700;color:#2578ff;}'

  + '.pmedia{grid-column:2;justify-self:end;display:flex;align-items:center;justify-content:center;position:relative;}'
  + '.pframe{position:relative;width:160px;height:116px;border-radius:14px;border:2px solid #dfe7f0;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;}'
  + '.pimg{width:100%;height:100%;object-fit:contain;background:#fff;display:block;}'
  + '.pimg-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-weight:700;background:#f1f5f9;}'

  /* Hot badge — centered over image */
  + '.hotcap{position:absolute;top:-12px;left:50%;transform:translateX(-50%);z-index:3;}'
  + '.badge-hot{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font:700 12.5px/1.1 system-ui,-apple-system,Segoe UI,Heebo,Arial,sans-serif;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;box-shadow:0 1px 0 rgba(0,0,0,.04);white-space:nowrap;}'
  + '.badge-hot svg{width:14px;height:14px}'
  + '.pulse{animation:pulse 2.8s ease-in-out infinite}'
  + '@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0)}50%{box-shadow:0 0 0 8px rgba(249,115,22,.12)}}'

  /* Footer (desktop visible, mobile hidden) */
  + '.p-foot{display:grid;grid-template-columns:1fr auto;align-items:center;padding:6px 12px 8px;gap:0;direction:ltr;}'
  + '.foot-left{justify-self:start;}'
  + '.pbadge{display:inline-flex;align-items:center;gap:8px;height:26px;padding:0 10px;border-radius:999px;background:#e9f8ec;border:1px solid #bfe8c8;font-size:11.5px;font-weight:700;color:#198038;white-space:nowrap;direction:ltr;}'
  + '.pbadge .check{width:16px;height:16px;display:inline-block;}'
  + '.foot-right{display:none;}'

  /* Mobile-only tweaks: +5px top & bottom, hide footer, time above sentence */
  + '@media (max-width:480px){'
  + '  .card{width:330px;}'
  + '  .p-top{grid-template-columns:1fr 144px;padding:13px 10px 5px;gap:10px;}/* +5 top, +5 bottom */'
  + '  .pframe{width:144px;height:104px;}'
  + '  .hotcap{top:-10px;}'
  + '  .p-foot{display:none;}/* remove bottom white space */'
  + '}'

  /* Desktop (unchanged layout) */
  + '@media (min-width:720px){'
  + '  .p-top{grid-template-columns:1fr 168px;}'
  + '  .pframe{width:160px;height:116px;}'
  + '}'
  ;
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  /* ---- helpers ---- */
  function firstLetter(s){ s=(s||"").trim(); return (s[0]||"?").toUpperCase(); }
  function colorFromString(s){ s=s||""; for(var h=0,i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return "hsl("+(h%360)+" 70% 45%)"; }
  function escapeHTML(s){ return String(s||"").replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]);}); }
  function firstName(s){ s=String(s||"").trim(); var parts=s.split(/\s+/); return parts[0]||s; }
  function truncateWords(s,n){ s=(s||"").replace(/\s+/g," ").trim(); var p=s?s.split(" "):[]; return p.length>n?p.slice(0,n).join(" ")+"…":s; }
  function scaleClass(text){ var t=(text||"").trim(), L=t.length; if(L>220) return "tiny"; if(L>140) return "small"; return ""; }
  function timeAgo(ts){ try{ var d=new Date(ts); var diff=Math.max(0,(Date.now()-d.getTime())/1000); var m=Math.floor(diff/60), h=Math.floor(m/60), d2=Math.floor(h/24); if(d2>0) return d2===1?"אתמול":"לפני "+d2+" ימים"; if(h>0) return "לפני "+h+" שעות"; if(m>0) return "לפני "+m+" דקות"; return "כרגע"; }catch(_){ return ""; } }

  /* Avatar helpers */
  function renderMonogram(name){ var d=document.createElement("div"); d.className="avatar-fallback"; d.textContent=firstLetter(name); d.style.background=colorFromString(name); return d; }
  function renderAvatarPreloaded(name, url){
    var shell = renderMonogram(name);
    if(url){
      var img = new Image(); img.width=40; img.height=40; img.decoding="async"; img.loading="eager";
      img.onload=function(){ var tag=document.createElement("img"); tag.className="avatar"; tag.alt=""; tag.width=40; tag.height=40; tag.decoding="async"; tag.loading="eager"; tag.src=url; shell.replaceWith(tag); };
      img.onerror=function(){};
      img.src=url;
    }
    return shell;
  }
  function renderAvatar(name,url){
    var d=document.createElement("div"); d.className="avatar-fallback";
    d.textContent=(name||"?").trim().charAt(0).toUpperCase()||"?";
    var s=name||"", h=0; for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    d.style.background="hsl("+(h%360)+" 70% 45%)";
    if(url){
      var pre = new Image();
      pre.width=40; pre.height=40; pre.decoding="async"; pre.loading="eager";
      pre.onload=function(){ var img=document.createElement("img"); img.className="avatar"; img.alt=""; img.width=40; img.height=40; img.decoding="async"; img.loading="eager"; img.src=url; d.replaceWith(img); };
      pre.onerror=function(){};
      pre.src=url;
    }
    return d;
  }
  function renderAvatarLazy(name, url){ return renderAvatar(name, url); }

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

  /* ---- fetchers with mirror failover ---- */
  var JS_MIRRORS = ["https://cdn.jsdelivr.net","https://fastly.jsdelivr.net","https://gcore.jsdelivr.net"];
  function rewriteToMirror(u, mirror){
    try { var a=new URL(u), m=new URL(mirror); a.protocol=m.protocol; a.host=m.host; return a.toString(); } catch(_){ return u; }
  }
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

  /* ---- renderers ---- */
  function renderReviewCard(item){
    var card=document.createElement("div"); card.className="card fade-in";
    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 350); });
    card.appendChild(x);

    var header=document.createElement("div"); header.className="row-r";
    var avatarEl = renderAvatarPreloaded(item.authorName, item.profilePhotoUrl);
    var meta=document.createElement("div"); meta.className="meta";
    var name=document.createElement("div"); name.className="name"; name.textContent=item.authorName||"Anonymous";
    meta.appendChild(name);
    header.appendChild(avatarEl); header.appendChild(meta); header.appendChild(document.createElement("span"));

    var body=document.createElement("div");
    var shortText=truncateWords(item.text, MAX_WORDS);
    body.className="body "+scaleClass(shortText); body.textContent=shortText;

    var brand=document.createElement("div"); brand.className="brand";
    brand.innerHTML = ''
      + '<span class="gmark" aria-label="Google">'
      + '  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
      + '    <path fill="#4285F4" d="M21.35 11.1h-9.17v2.98h5.37c-.23 1.26-.93 2.33-1.98 3.04v2.52h3.2c1.87-1.72 2.95-4.25 2.95-7.27 0-.7-.06-1.37-.17-2.01z"></path>'
      + '    <path fill="#34A853" d="M12.18 22c2.67 0 4.9-.88 6.53-2.36ל-3.2-2.52c-.89.6-2.03.95-3.33.95-2.56 0-4.72-1.73-5.49-4.05H3.4v2.56A9.818 9.818 0 0 0 12.18 22ז"></path>'
      + '    <path fill="#FBBC05" d="M6.69 14.02a5.88 5.88 0 0 1 0-3.82В7.64H3.4a9.82 9.82 0 0 0 0 8.72"></path>'
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

    var x=document.createElement("button"); x.className="xbtn"; x.setAttribute("aria-label","Close"); x.textContent="×";
    x.addEventListener("click",function(){ card.classList.remove("fade-in"); card.classList.add("fade-out"); setTimeout(function(){ if(card.parentNode){ card.parentNode.removeChild(card);} }, 350); });
    card.appendChild(x);

    /* ---------- TOP ROW ---------- */
    var top=document.createElement("div"); top.className="p-top";

    var textCol=document.createElement("div"); textCol.className="ptext";

    // TIME — always above the sentence (mobile+desktop)
    var tTop=document.createElement("div"); tTop.className="ptime-top";
    tTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
                   + '  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>'
                   + '  <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
                   + '</svg>' + escapeHTML(timeAgo(p.purchased_at));
    textCol.appendChild(tTop);

    // MAIN SENTENCE
    var sentence=document.createElement("div"); sentence.className="psentence";
    var buyerFirst = firstName(p.buyer);
    sentence.innerHTML = '<strong class="buyer">'+escapeHTML(buyerFirst)+'</strong> רכש/ה '
                       + '<span class="prod">'+escapeHTML(p.product)+'</span>';
    textCol.appendChild(sentence);

    // IMAGE
    var media=document.createElement("div"); media.className="pmedia";
    var frame=document.createElement("div"); frame.className="pframe";
    var imgEl;
    function fb(){ var d=document.createElement("div"); d.className="pimg-fallback"; d.textContent="✓"; return d; }
    function swap(el){ if(imgEl && imgEl.parentNode){ imgEl.parentNode.replaceChild(el, imgEl);} imgEl = el; }
    if (p.image) {
      var pre = new Image(); pre.decoding="async"; pre.loading="eager";
      pre.onload = function(){ var tag=document.createElement("img"); tag.className="pimg"; tag.alt=""; tag.src=p.image; swap(tag); };
      pre.onerror = function(){ swap(fb()); };
      pre.src = p.image; imgEl = fb();
    } else { imgEl = fb(); }
    frame.appendChild(imgEl);
    media.appendChild(frame);

    // HOT badge — centered over image
    var hotcap = document.createElement('div'); hotcap.className = 'hotcap';
    hotcap.innerHTML = ''
      + '<span class="badge-hot pulse" role="status" aria-live="polite">'
      + '  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 2s1 3-1.5 5.5S9 12 9 14a5 5 0 0010 0c0-3-2-4.5-3-6.5-1-2 0-5-2.5-5.5z"/></svg>'
      + '  פופולרי עכשיו'
      + '</span>';
    media.appendChild(hotcap);

    top.appendChild(textCol);
    top.appendChild(media);
    card.appendChild(top);

    /* ---------- FOOTER (desktop only; hidden on mobile via CSS) ---------- */
    var foot=document.createElement("div"); foot.className="p-foot";
    var left=document.createElement("div"); left.className="foot-left";
    var pill=document.createElement("div"); pill.className="pbadge";
    pill.innerHTML = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true">'
                   +   '<circle cx="12" cy="12" r="11" fill="#2ecc71" opacity=".18"/>' 
                   +   '<path d="M10.2 14.6l-2.1-2.1-1.4 1.4 3.5 3.5 6-6-1.4-1.4-4.6 4.6z" fill="#1a9f4b"/>'
                   + '</svg>'
                   + '<span class="evid">EVID</span><span class="verified">מאומת</span>';
    left.appendChild(pill);
    foot.appendChild(left);
    card.appendChild(foot);

    return card;
  }

  /* ---- rotation ---- */
  function interleave(reviews, purchases){
    var out=[], i=0, j=0;
    while(i<reviews.length || j<purchases.length){
      if(i<reviews.length){ out.push({kind:"review", data:reviews[i++]}); }
      if(j<purchases.length){ out.push({kind:"purchase", data:purchases[j++]}); }
    }
    return out;
  }

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

  /* ---- data loading ---- */
  function loadAll(){
    var p1 = REVIEWS_EP ? fetchJSON(REVIEWS_EP).then(function(d){ var a=normalizeArray(d,"review"); log("reviews:", a.length); return a; }).catch(function(e){ console.warn("reviews fetch err:", e); return []; }) : Promise.resolve([]);
    var p2 = PURCHASES_EP ? fetchJSON(PURCHASES_EP).then(function(d){ var a=normalizeArray(d,"purchase"); log("purchases:", a.length); return a; }).catch(function(e){ console.warn("purchases fetch err:", e); return []; }) : Promise.resolve([]);
    Promise.all([p1,p2]).then(function(r){ var rev = r[0]||[], pur = r[1]||[]; items = interleave(rev, pur); log("total items:", items.length); start(); })
    .catch(function(e){ root.innerHTML = '<div style="font-family: system-ui; color:#c00; background:#fff3f3; padding:12px; border:1px solid #f7caca; border-radius:8px">Widget error: '+ String(e && e.message || e) +'</div>'; console.error("[both-controller v3.6.4]", e); });
  }
  loadAll();
})();
