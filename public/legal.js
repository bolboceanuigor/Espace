// language switch (#ro / #ru) and the operator's details from Settings in the admin panel
(function(){
  const show=l=>{document.querySelectorAll("main[lang]").forEach(m=>m.hidden=m.lang!==l);document.querySelectorAll(".lang a").forEach(a=>a.toggleAttribute("aria-current",a.dataset.l===l));document.documentElement.lang=l};
  const pick=()=>show(location.hash==="#ru"?"ru":"ro");
  addEventListener("hashchange",pick);pick();
  fetch("/api/site_info",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>r.ok?r.json():null).then(s=>{if(!s)return;
    document.querySelectorAll("[data-seller]").forEach(e=>{const v=s[e.dataset.seller];if(v)e.textContent=v});
    document.querySelectorAll("[data-seller-wrap]").forEach(e=>e.hidden=!s[e.dataset.sellerWrap]);
    document.querySelectorAll("[data-seller-link]").forEach(a=>{const v=s[a.dataset.sellerLink];if(v)a.href="mailto:"+v})}).catch(()=>{});
})();
