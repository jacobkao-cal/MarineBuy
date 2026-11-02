// Marine Buy front end. Catalog data is available as static JSON for GitHub Pages and the local server.
import { computeScore } from './score.js';
import * as Likes from './likes.js';
import * as Workspace from './workspace.js';
import * as Accounts from './accounts.js';
import * as Hub from './profile-hub.js';
import * as Gear from './gear.js';
let PRODUCTS=[],OFFERS=[],IMAGES=[],SOURCES=[],VIDEOS=[],WP={},TONE={},SPECS=[],AUTH={},RIGHTS='',CHECKED='';
const score=id=>computeScore(id,{SOURCES,WP,TONE});
async function init(){let c;
  try{const r=await fetch(new URL('data/catalog.json',document.baseURI));if(!r.ok)throw new Error(`Catalog request failed (${r.status})`);c=await r.json()}
  catch(e){document.querySelector('#app').innerHTML='<div class="empty">Could not load jacket research. Try refreshing the page.</div>';return}
  ({products:PRODUCTS,offers:OFFERS,images:IMAGES,sources:SOURCES,videos:VIDEOS}=c);({WP,TONE}=c.scoring);({SPECS,AUTH,RIGHTS,CHECKED}=c.meta);Hub.configure({catalog:()=>({products:PRODUCTS,images:IMAGES})});
  const profileId=Accounts.current()?.id||null;Likes.useScope(profileId);Workspace.useProfileScope(profileId,id=>!!P(id));startLikes();render();
}
Accounts.configure({onScopeChange:profileId=>{
  Likes.useScope(profileId);Likes.load(id=>!!P(id));Workspace.useProfileScope(profileId,id=>!!P(id));syncCount();$("#nav-account").innerHTML=Accounts.navHtml();
}});
// ---- Likes (private, this browser only; state lives in likes.js) ----
const HEART='<svg class="hrt" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.4-9.1C1.3 8.2 3.2 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3.1 1.6-1.9 3.1-3.1 5.2-3.1 3.6 0 5.5 3.7 4.2 6.9-1.9 4.5-9.4 9.1-9.4 9.1z"/></svg>';
let confirmClear=false,pendingFocus=null;
const pname=p=>`${p.brand} ${p.name}`;
function startLikes(){const r=Likes.load(id=>!!P(id)),s=parse(),msgs=[];let added=[];
 if(r.dropped)msgs.push(`${r.dropped} saved jacket${r.dropped==1?" is":"s are"} no longer in the catalog and ${r.dropped==1?"was":"were"} removed from My Likes.`);
 // One-time migration: the old Compare buttons kept the selection only in the URL (?cmp=). Save it as Likes on the first visit after this update.
 if(r.fresh&&Likes.available()){if(s.cmp.length){added=Likes.importIds(s.cmp,true);if(added.length)msgs.push(`Your ${added.length} compared jacket${added.length==1?" was":"s were"} saved to My Likes and selected for comparison.`)}else Likes.clearAll()}
 if(s.cmp.length&&s.path!=="/compare")history.replaceState(null,"",url(s));
 notice(msgs,added);Likes.onChange(syncLikes);addEventListener("storage",e=>{if(e.key===Likes.storageKey()||e.key===null)Likes.reload()});syncCount()}
function notice(msgs,added){const n=$("#notice");if(!msgs.length){n.innerHTML="";return}
 n.innerHTML=`<div class="notice"><span>${msgs.map(esc).join(" ")}</span> <a href="#/likes">Open My Likes</a>${added.length?' <button type="button" class="btn" id="nt-undo">Undo</button>':""} <button type="button" class="btn" id="nt-x">Dismiss</button></div>`;
 live(msgs.join(" "));
 $("#nt-undo")?.addEventListener("click",()=>{added.forEach(Likes.remove);notice([`Undone: ${added.length} jacket${added.length==1?"":"s"} removed from My Likes.`],[]);$("#nt-x").focus()});
 $("#nt-x").addEventListener("click",()=>{n.innerHTML="";$("#app").focus()})}
function live(m){const l=$("#live");l.textContent="";setTimeout(()=>{l.textContent=m},40)}
function likeBtn(id){const p=P(id),on=Likes.has(id);return`<button type="button" class="btn like" aria-pressed="${on}" data-like="${esc(id)}">${HEART}<span class="lb">${on?"Liked":"Like"}</span><span class="vh"> ${esc(pname(p))}</span></button>`}
function syncCount(){const n=Likes.count();$("#likes-n").textContent=n;$("#nav-likes").dataset.on=n?1:0}
function syncLikes(){const s=parse();
 document.querySelectorAll("[data-like]").forEach(b=>{const on=Likes.has(b.dataset.like);b.setAttribute("aria-pressed",on);b.querySelector(".lb").textContent=on?"Liked":"Like"});
 syncCount();tray(s);if(s.path==="/likes"){const f=pendingFocus;pendingFocus=null;rerenderLikes(f)}}
function onLike(b){const id=b.dataset.like,p=P(id);if(!p)return;const was=Likes.has(id),on=Likes.toggle(id);
 if(!was&&!on){live(`My Likes is full (${Likes.MAX_LIKES} jackets). Remove some to add more.`);return}
 document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach(x=>{x.classList.remove("pop");if(on){void x.offsetWidth;x.classList.add("pop")}});
 live(`${pname(p)} ${on?"added to":"removed from"} My Likes. ${Likes.count()} saved.`)}
function renderLikes(s){Workspace.mount({products:PRODUCTS,offers:OFFERS,videos:VIDEOS,route:s,url,photo,gallery,likeBtn,sourceBlock:id=>srcBlock2(id,true),fmtD,live,heart:HEART,confirmClear:()=>confirmClear,setFocus:s=>pendingFocus=s})}
function rerenderLikes(target){Workspace.refresh(target)}
const ini=n=>n.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?';
function rvf(k,b){b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));(b.closest('.research-product')||document).querySelectorAll('.rv').forEach(r=>{r.hidden=!(k==='all'||r.dataset[k]==='1')})}
function srcBlock2(id,workspace=false){const S=[...SOURCES.filter(x=>x.p===id)].sort((a,b)=>a.rel.startsWith('RELATED')-b.rel.startsWith('RELATED')),ex=S.filter(x=>!x.rel.startsWith('RELATED')).length,drn=S.filter(x=>x.items.some(i=>i.kind==='drawback')).length;
 const post=x=>{const a=AUTH[x.id]||x.plat,rel=x.rel.startsWith('RELATED'),dr=x.items.some(i=>i.kind==='drawback'),body=x.sum||x.items.map(i=>i.t).join(' ')||'No written summary yet.';
 return`<article class='rv' data-ex='${rel?0:1}' data-rel='${rel?1:0}' data-dr='${dr?1:0}'><div class='rh'><span class='av' aria-hidden='true'>${esc(ini(a))}</span><div><strong>${esc(a)}</strong><div class='mu'>${esc(x.plat)} · ${esc(x.type)}</div></div></div><div><span class='bdg ${rel?'':'ex'}'>${rel?'Earlier version':'Exact model'}</span><strong>${esc(x.title)}</strong></div><div class='mu'>${x.pub?'Posted '+fmtD(x.pub):'Posting date not stated'} · Ownership not verified</div><p class='rb'>${esc(body)}</p>${x.rating?`<p class='mu'>${esc(x.rating)}. Shown as reported; not combined into any score.</p>`:''}${rel?`<p class='warn' style='font-size:13px;margin:4px 0'>${esc(x.rel.replace(/^RELATED MODEL: /,''))}</p>`:''}<div class='rf'><a class='btn' href='${esc(x.url)}' target='_blank' rel='noopener noreferrer'>Read the original</a><span class='mu'>Checked ${fmtD(x.chk)} · ID ${esc(x.id)}</span></div></article>`};
 const chip=(k,l,n)=>`<button type='button' aria-pressed='${k==='all'}' onclick="rvf('${k}',this)">${l} (${n})</button>`;
 return`<h2>Customer &amp; community feedback</h2>${S.length?`<p class='mu'>${S.length} posts and reviews, ${ex} about this exact model. Each is one person's or outlet's view, summarised in our words. The Marine Buy Score ${workspace?'on the product page':'above'} combines these using the published formula; ownership is not verified. No Reddit thread has been verified yet.</p><div class='chips' role='group' aria-label='Filter feedback'>${chip('all','All',S.length)}${chip('ex','Exact model',ex)}${chip('rel','Earlier versions',S.length-ex)}${chip('dr','Mentions drawbacks',drn)}</div>${S.map(post).join('')}`:`<div class='empty'>No reviews or discussions have been verified for this model yet. Supply Amazon, Reddit or forum URLs to add them.</div>`}${dif(id)}<h2>YouTube reviews</h2>${VIDEOS.filter(v=>v.p===id).map(v=>`<div class='src'><a href='${esc(v.url)}' target='_blank' rel='noopener noreferrer'>${esc(v.title)}</a> <span class='mu'>${esc(v.channel)}</span></div>`).join('')||`<div class='empty'>No verified YouTube review yet. Supply video URLs for this exact model.</div>`}`}
function scoreChip(id){const r=score(id);return r.total==null?"<span class='mu'>Not rated yet</span>":`<strong>★ ${r.total.toFixed(1)}</strong> <span class='mu'>/5 · ${r.conf==='Low'?'provisional':r.conf.toLowerCase()+' evidence'}</span>`}
function scoreBox(id){const r=score(id);let h;
 if(r.total==null)h=`<strong style='font-size:20px'>Not rated yet</strong><p class='mu' style='margin:4px 0'>A score needs independent feedback worth at least 1.0 weight (one independent review of this exact model, or two of earlier versions). This jacket has ${r.W.toFixed(1)} so far.</p>`;
 else{const n=Math.round(r.total);h=`<div><span style='font-size:34px;font-weight:700'>${r.total.toFixed(1)}</span> <span class='mu'>/ 5</span> <span class='tag'>${r.conf==='Low'?'Provisional, low evidence':r.conf+' evidence'}</span></div><div aria-hidden='true' style='color:var(--ac);font-size:18px;letter-spacing:2px'>${'★'.repeat(n)}${'☆'.repeat(5-n)}</div>`}
 const rows=SOURCES.filter(x=>x.p===id&&TONE[x.id]).map(x=>{const t=TONE[x.id],rel=x.rel.startsWith('RELATED');return`<tr><td><a href='${esc(x.url)}' target='_blank' rel='noopener noreferrer'>${esc(x.plat)}</a><br><span class='mu'>${rel?'Earlier version':'Exact model'}</span></td><td>${t[0].toFixed(1)}<br><span class='mu'>${esc(t[3])}</span></td><td>${(t[2]*(rel?.5:1)).toFixed(1)}</td></tr>`}).join('');
 const brand=SOURCES.filter(x=>x.p===id&&x.rating).map(x=>`<p class='mu'>Not scored: ${esc(x.plat)}, ${esc(x.rating)}. Brand-hosted ratings are shown but excluded because the seller hosts them.</p>`).join('');
 return`<div class='sc' role='group' aria-label='Marine Buy Score'><div class='mu'>Marine Buy Score</div>${h}<details><summary>How this score is calculated</summary><p><b>Score</b> = average of the parts available: Spec score (50%) and Feedback score (50%).</p><p><b>Spec score: ${r.sp==null?'not scorable (no numeric brand waterproof rating)':r.sp.toFixed(1)}.</b> Waterproof rating only: 30,000mm+ = 5.0, 20,000mm+ = 4.5, 15,000mm+ = 3.5, 10,000mm+ = 3.0, lower = 2.0, using the lowest figure sources cite. These are brand claims on different test methods. Breathability is not scored because brands use incompatible scales.</p><p><b>Feedback score: ${r.fb==null?'none yet':r.fb.toFixed(1)}.</b> Weighted average of our 1–5 reading of each independent source. Weight is 1.0 for editorial reviews and 0.6 for forum posts, halved for earlier versions. Pieces from the same outlet are averaged and count once. Brand and retailer text is excluded. Our readings are editorial judgments, listed below so you can disagree.</p><p><b>Evidence: ${r.conf}</b> (total weight ${r.W.toFixed(1)}; Low under 2.0, Moderate 2.0–3.9, High 4.0+). A score appears only at 1.0 or more.</p>${rows?`<div class='scroll'><table><tr><th>Source</th><th>Our reading</th><th>Weight</th></tr>${rows}</table></div>`:''}${brand}</details></div>`}
const dif=id=>{const d=P(id)?.differ||[];return`<h2>Where opinions differ</h2>${d.length?`<div>${d.map(x=>`<p class="src">${esc(x.t)} ${x.ids.map(i=>{const s=SOURCES.find(z=>z.id===i);return`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.plat)}</a>`}).join(", ")}</p>`).join("")}</div>`:'<div class="empty">No conflicting reports recorded. Needs at least two sources on the same point.</div>'}`};
// ---- App ----
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const P=id=>PRODUCTS.find(x=>x.id===id),offer=id=>OFFERS.filter(o=>o.p===id);
const lowest=id=>{const v=offer(id).filter(o=>o.price!=null);return v.length?Math.min(...v.map(o=>o.price)):null};
const fmtD=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):"Not stated";
function parse(){const h=location.hash.replace(/^#/,"")||"/",[path,qs=""]=h.split("?"),u=new URLSearchParams(qs);
 return{path,q:u.get("q")||"",brand:u.get("brand")||"",tier:u.get("tier")||"",price:u.get("price")||"",cmp:[...new Set((u.get("cmp")||"").split(",").filter(x=>P(x)))].slice(0,4)}}
// Only the comparison page carries product IDs (?cmp=) so it stays shareable. Likes and notes never go in a URL.
function url(s,path){const p=path??s.path,u=new URLSearchParams();["q","brand","tier","price"].forEach(k=>s[k]&&u.set(k,s[k]));if(p==="/compare"&&s.cmp?.length)u.set("cmp",s.cmp.join(","));const q=u.toString();return"#"+p+(q?"?"+q:"")}
function go(patch,path){const s={...parse(),...patch};location.hash=url(s,path)}
function priceBand(p){return p==null?"unknown":p<300?"lt300":p<=400?"300-400":"gt400"}
const BANDS={lt300:"Under $300","300-400":"$300–$400",gt400:"Over $400",unknown:"Price not verified"};
function filtered(s){const q=s.q.toLowerCase().trim();return PRODUCTS.filter(p=>(!q||[p.name,p.brand,p.tier,p.use].join(" ").toLowerCase().includes(q))&&(!s.brand||p.brand===s.brand)&&(!s.tier||p.tier===s.tier)&&(!s.price||priceBand(lowest(p.id))===s.price))}
// ---- Photos: data/images.json holds one record per photo; array order is gallery order (first = main photo) ----
const imgs=id=>IMAGES.filter(i=>i.p===id);
const VIEW={front:"Front",back:"Back",side:"Side",detail:"Detail",lifestyle:"In use"};
function photo(p,big){const i=imgs(p.id)[0],o=offer(p.id)[0];
 const fb=`<span>Product photo unavailable${o?`<br><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">View at ${esc(o.ret)}</a>`:""}</span>`;
 if(!i)return`<div class="ph">${fb}</div>`;
 return`<div class="ph"><img src="${esc(encodeURI(i.file))}" alt="${esc(i.alt)}" ${big?"":'loading="lazy"'} width="640" height="640" onerror="this.parentNode.dataset.fail=1;this.parentNode.innerHTML=this.parentNode.dataset.fb" data-x=""></div>`.replace('class="ph"',`class="ph" data-fb="${esc(fb)}"`)}
// Swipeable photo carousel (scroll-snap, so touch swipe is native). Arrow buttons and Left/Right keys move one photo; wraps at the ends.
// big = product page: larger, with thumbnails and a per-photo credit line.
function gallery(p,big){const L=imgs(p.id),n=L.length;if(n<2)return photo(p,big);
 const cap=(i,k)=>`Photo ${k+1} of ${n} · ${VIEW[i.view]||i.view} · ${i.by}. Rights unconfirmed (demo only). Source: ${i.src}`;
 return`<div class="gal${big?" big":""}" data-pid="${esc(p.id)}"><div class="gal-view"><div class="gal-track" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Photos of ${esc(pname(p))}, ${n} images. Use the left and right arrow keys to browse.">${L.map((i,k)=>`<div class="ph gal-slide" role="group" aria-roledescription="slide" aria-label="${k+1} of ${n}, ${esc(VIEW[i.view]||i.view)}" data-cap="${esc(cap(i,k))}"><img src="${esc(encodeURI(i.file))}" alt="${esc(i.alt)}" ${big&&!k?"":'loading="lazy"'} decoding="async"></div>`).join("")}</div>
 <button type="button" class="gal-btn prev" data-gal="-1" aria-label="Previous photo of ${esc(pname(p))}"><span aria-hidden="true">‹</span></button><button type="button" class="gal-btn next" data-gal="1" aria-label="Next photo of ${esc(pname(p))}"><span aria-hidden="true">›</span></button><span class="gal-n" aria-hidden="true">1 / ${n}</span><button type="button" class="gal-zoom" data-lb-open aria-label="Enlarge photos of ${esc(pname(p))}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
 ${big?`<div class="gal-th" role="group" aria-label="Choose a photo">${L.map((i,k)=>`<button type="button" data-gal-go="${k}" aria-current="${!k}" aria-label="Show photo ${k+1}: ${esc(i.alt)}"><img src="${esc(encodeURI(i.file))}" alt="" loading="lazy"></button>`).join("")}</div><p class="mu gal-cap">${esc(cap(L[0],0))}</p>`:""}</div>`}
const galIdx=t=>Math.round(t.scrollLeft/(t.clientWidth||1));
function galGo(g,k){const t=g.querySelector(".gal-track"),n=t.children.length;k=(k+n)%n;
 t.scrollTo({left:k*t.clientWidth,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}
function galSync(t){const g=t.closest(".gal"),k=galIdx(t),s=t.children[k];if(!s)return;g.dataset.k=k;
 g.querySelector(".gal-n").textContent=`${k+1} / ${t.children.length}`;
 g.querySelectorAll("[data-gal-go]").forEach((b,i)=>b.setAttribute("aria-current",i===k));
 const c=g.querySelector(".gal-cap");if(c)c.textContent=s.dataset.cap}
document.addEventListener("scroll",e=>{if(e.target.classList?.contains("gal-track"))galSync(e.target)},true);
document.addEventListener("keydown",e=>{const t=e.target,arrow=["ArrowLeft","ArrowRight"].includes(e.key);
 if(t.classList?.contains("gal-track")&&e.key==="Enter"&&!t.closest(".viewer")){e.preventDefault();return openLightbox(t.closest(".gal"),galIdx(t),t)}
 const g=t.classList?.contains("gal-track")?t.closest(".gal"):t.closest?.(".viewer")&&$(".viewer .gal");
 if(!g||!arrow||t.tagName==="INPUT")return;e.preventDefault();galGo(g,galIdx(g.querySelector(".gal-track"))+(e.key==="ArrowRight"?1:-1))});
// ---- Click-to-enlarge photo viewer: a native modal <dialog> (focus stays inside, Escape closes, page behind keeps its scroll and state) ----
let lbFrom=null;
function lightbox(){let d=$("#lb");if(d)return d;
 d=Object.assign(document.createElement("dialog"),{id:"lb",className:"viewer"});d.setAttribute("aria-labelledby","lb-t");
 d.innerHTML=`<div class="lb-top"><h2 id="lb-t" class="lb-t"></h2><button type="button" class="lb-x" data-lb-close aria-label="Close photo viewer"><span aria-hidden="true">×</span></button></div><div class="gal lb-gal"></div>`;
 d.addEventListener("close",()=>{const f=lbFrom;lbFrom=null;if(!f)return;const t=f.g.querySelector(".gal-track"),k=+($(".viewer .gal").dataset.k||0); // read the saved index: the closed dialog is hidden, so its scroll position reads 0
  if(t){t.scrollTo({left:k*t.clientWidth,behavior:"auto"});galSync(t)}d.querySelector(".lb-gal").innerHTML="";(document.contains(f.el)?f.el:$("#app")).focus({preventScroll:true})});
 // Clicking the dark area around the photo closes the viewer; clicking the photo itself does not.
 d.addEventListener("click",e=>{if(e.target===d||e.target.classList.contains("lb-slide"))d.close()});
 document.body.append(d);return d}
function openLightbox(g,k,opener){const p=P(g.dataset.pid),L=imgs(p.id),n=L.length,d=lightbox(),lg=d.querySelector(".lb-gal");
 const cap=(i,j)=>`Photo ${j+1} of ${n} · ${VIEW[i.view]||i.view} · ${i.by}. Rights unconfirmed (demo only). Source: ${i.src}`;
 d.querySelector("#lb-t").textContent=pname(p);lbFrom={g,el:opener};
 lg.innerHTML=`<div class="gal-view"><div class="gal-track" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Enlarged photos, ${n} images. Use the left and right arrow keys to browse.">${L.map((i,j)=>`<div class="gal-slide lb-slide" role="group" aria-roledescription="slide" aria-label="${j+1} of ${n}, ${esc(VIEW[i.view]||i.view)}" data-cap="${esc(cap(i,j))}"><img src="${esc(encodeURI(i.file))}" alt="${esc(i.alt)}" ${Math.abs(j-k)>1?'loading="lazy"':""} decoding="async"></div>`).join("")}</div>${n>1?`<button type="button" class="gal-btn prev" data-gal="-1" aria-label="Previous photo"><span aria-hidden="true">‹</span></button><button type="button" class="gal-btn next" data-gal="1" aria-label="Next photo"><span aria-hidden="true">›</span></button>`:""}<span class="gal-n" aria-live="polite">${k+1} / ${n}</span></div><p class="gal-cap"></p>`;
 d.showModal();const t=lg.querySelector(".gal-track");t.scrollLeft=k*t.clientWidth;galSync(t);d.querySelector(".lb-x").focus()}
// Click a carousel photo (not a swipe) to enlarge it.
document.addEventListener("click",e=>{const sl=e.target.closest(".gal-slide");if(!sl||sl.closest(".viewer"))return;const g=sl.closest(".gal");openLightbox(g,[...sl.parentNode.children].indexOf(sl),g.querySelector(".gal-track"))});
// A photo that fails to load is replaced by a plain message (a load failure, not a rights issue).
document.addEventListener("error",e=>{const i=e.target;if(i.tagName!=="IMG")return;
 if(i.closest(".gal-th")){i.hidden=true;return}
 if(i.closest(".gal-slide"))i.replaceWith(Object.assign(document.createElement("span"),{textContent:"Photo failed to load"}))},true);
function priceHtml(id){const v=offer(id).filter(o=>o.price!=null).sort((a,b)=>a.price-b.price)[0];return v?`<span class="pr">$${v.price}</span> <span class="mu">at ${esc(v.ret)} · checked ${fmtD(v.chk)}</span>`:'<span class="mu">Check price at retailer</span>'}
function renderList(s){const L=filtered(s),brands=[...new Set(PRODUCTS.map(p=>p.brand))],tiers=[...new Set(PRODUCTS.map(p=>p.tier))],any=s.q||s.brand||s.tier||s.price;
 const sel=(k,l,opts,lab)=>`<label for="f-${k}">${l}</label><select id="f-${k}" data-f="${k}"><option value="">All</option>${opts.map(o=>`<option value="${esc(o)}"${s[k]===o?" selected":""}>${esc(lab?lab[o]:o)}</option>`).join("")}</select>`;
 $("#app").innerHTML=`<p class="note">A curated starter set of ${PRODUCTS.length} jackets from the owner's shortlist, not full market coverage. Prices appear only where read from a retailer page on the date shown.</p>
 <div class="layout"><aside class="filters" aria-label="Filters"><strong>Filter</strong>${sel("brand","Brand",brands)}${sel("tier","Intended use",tiers)}${sel("price","Price",Object.keys(BANDS),BANDS)}<p><button class="btn" id="clr" ${any?"":"disabled"}>Clear all</button></p></aside>
 <section><h1>Sailing jackets <span class="mu" style="font-size:15px;font-weight:400">${L.length} result${L.length==1?"":"s"}${s.q?` for “${esc(s.q)}”`:""}</span></h1>
 ${L.length?`<div class="grid">${L.map(p=>`<article class="card">${gallery(p)}<span class="tag">${esc(p.tier)}</span><div>${scoreChip(p.id)}</div><h3><a href="${url(s,"/p/"+p.id)}">${esc(p.brand)} ${esc(p.name)}</a></h3><div>${priceHtml(p.id)}</div>${likeBtn(p.id)}</article>`).join("")}</div>`:`<div class="empty" role="status"><strong>No jackets match.</strong> Try a different search or <button class="btn" id="clr2">clear all filters</button>.</div>`}</section></div>`;
 $("#q").value=s.q;$("#clr")?.addEventListener("click",()=>go({q:"",brand:"",tier:"",price:""},"/"));$("#clr2")?.addEventListener("click",()=>go({q:"",brand:"",tier:"",price:""},"/"));
 document.querySelectorAll("[data-f]").forEach(e=>e.addEventListener("change",()=>go({[e.dataset.f]:e.value},"/")))}
function srcBlock(id){const S=SOURCES.filter(x=>x.p===id),it=k=>S.flatMap(x=>x.items.filter(i=>i.kind===k).map(i=>({...i,s:x})));
 const sec=(h,k,e)=>{const a=it(k);return`<h2>${h}</h2>${a.length?`<ul>${a.map(i=>`<li>${esc(i.t)} <a href="${esc(i.s.url)}" target="_blank" rel="noopener noreferrer">${esc(i.s.plat)}</a> <span class="mu">(${esc(i.s.rel.startsWith("RELATED")?"related model":"exact model")}; one source, not a consensus)</span></li>`).join("")}</ul>`:`<div class="empty">${e}</div>`}`};
 return sec("What buyers report","report","No linked sources yet.")+sec("Potential drawbacks","drawback","No source-backed drawbacks recorded yet.")+dif(id)+
 `<h2>Reviews &amp; discussions (${S.length})</h2><p class="mu">Real, linked sources only. Each is one voice, not a consensus, and sources marked 'related model' may describe an earlier version. Retailer star ratings are never blended into a score. No Reddit thread has been verified for this model yet.</p>${S.length?[...S].sort((a,b)=>a.rel.startsWith("RELATED")-b.rel.startsWith("RELATED")).map(x=>`<div class="src"><strong>${esc(x.title)}</strong><br><span class="tag">${esc(x.type)}</span> <span class="tag">${esc(x.plat)}</span>${x.sum?`<p style="margin:6px 0">${esc(x.sum)}</p>`:"<br>"}<span class="mu">ID ${x.id} · Published ${fmtD(x.pub)} · Checked ${fmtD(x.chk)}</span><br><span class="${x.rel.startsWith("RELATED")?"warn":"mu"}">Relevance: ${esc(x.rel)}</span>${x.rating?`<br><span class="mu">${esc(x.rating)}. Shown as reported; not combined into any score.</span>`:""}<br><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Open original</a></div>`).join(""):'<div class="empty">No Amazon/retailer reviews, Reddit threads or forum posts verified for this model yet. Supply URLs to add them.</div>'}`+
 `<h2>YouTube reviews</h2>${VIDEOS.filter(v=>v.p===id).map(v=>`<div class="src"><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a> <span class="mu">${esc(v.channel)}</span></div>`).join("")||'<div class="empty">No verified YouTube review yet. Supply video URLs for this exact model.</div>'}`}
function renderProduct(s,id){const p=P(id);if(!p){$("#app").innerHTML='<div class="empty">Product not found. <a href="#/">Back to list</a></div>';return}const I=imgs(id),i=I[0];
 $("#app").innerHTML=`<p><a href="${url(s,"/")}">← All jackets</a></p><div class="two"><div>${gallery(p,1)}${I.length>1?"":`<p class="mu">${i?`Photo: ${esc(i.by)}. ${RIGHTS}<br>Source: ${esc(i.src)}`:"No photo on file."}</p>`}</div><div><span class="tag">${esc(p.tier)}</span><h1>${esc(p.brand)} ${esc(p.name)}</h1><p class="mu">Intended use: ${esc(p.use)}</p>${p.note?`<p class="warn">${esc(p.note)}</p>`:""}${scoreBox(id)}<div>${priceHtml(id)}</div><p class="own-row">${likeBtn(id)}${ownBtn(id)}</p>
 <h2>Retailer offers</h2><div class="scroll"><table><tr><th>Retailer</th><th>Price</th><th>Last checked</th><th>Link status</th><th></th></tr>${offer(id).map(o=>`<tr><td>${esc(o.ret)}</td><td>${o.price!=null?"$"+o.price:"Check price at retailer"}</td><td>${fmtD(o.chk)}</td><td class="mu">${esc(o.link)}</td><td><a class="btn p" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Buy Now<span class="vh"> at ${esc(o.ret)} (opens in a new tab)</span></a></td></tr>`).join("")}</table></div>
 <h2>Manufacturer specifications</h2><table>${SPECS.map(([k,l])=>`<tr><th scope="row">${l}</th><td>${esc(p.spec[k]||"Not provided")}</td></tr>`).join("")}</table><p class="mu">Source: ${p.specSrc?`<a href="${esc(p.specSrc)}" target="_blank" rel="noopener noreferrer">${esc(p.specSrc)}</a>`:"none verified"}</p></div></div>${srcBlock2(id)}`}
// "I own this" opens Add gear prefilled with this product. It never changes Likes, and retailer clicks are never treated as purchases.
function ownBtn(id){const g=Accounts.current()?Gear.list().filter(x=>x.productId===id):[];
 return`<a class="btn own" href="#/profile/gear/new?p=${encodeURIComponent(id)}">I own this<span class="vh">: ${esc(pname(P(id)))}</span></a>${g.length?` <span class="mu">In <a href="#/profile/gear">My gear</a>${g.map(x=>x.size?` · size ${esc(x.size)}`:"").join("")}</span>`:""}`}
function renderCompare(s){const L=s.cmp.map(P),back=`<p><a href="#/likes">← My Likes</a> · <a href="${url(s,"/")}">All jackets</a></p>`;
 if(L.length<2){$("#app").innerHTML=back+`<h1 id="cmp-h" tabindex="-1">Compare jackets</h1><div class="empty">${L.length?`<p>Only <strong>${esc(pname(L[0]))}</strong> is in this comparison. Add at least one more jacket to compare side by side.</p>`:"<p>No jackets are selected for comparison.</p>"}<p>Like jackets to save them, then select 2–4 in My Likes and choose <strong>Compare selected</strong>.</p><a class="btn p" href="#/likes">Go to My Likes (${Likes.count()})</a> <a class="btn" href="${url(s,"/")}">Browse jackets</a></div>`;return}
 const row=(l,f)=>`<tr><th scope="row">${l}</th>${L.map(p=>`<td>${f(p)}</td>`).join("")}</tr>`;
 $("#app").innerHTML=back+`<h1 id="cmp-h" tabindex="-1">Comparing ${L.length} jackets</h1><p class="mu">Removing a jacket from this comparison keeps it in My Likes.</p><div class="scroll"><table style="min-width:${130+L.length*210}px"><tr><th></th>${L.map(p=>`<th scope="col">${esc(p.brand)} ${esc(p.name)}<div class="cmp-a">${likeBtn(p.id)}<button type="button" class="btn" data-uncmp="${esc(p.id)}">Remove from comparison<span class="vh">: ${esc(pname(p))}</span></button></div></th>`).join("")}</tr>
 ${row("Photo",p=>`<div style="width:120px">${photo(p)}</div>`)}${row("Intended use",p=>esc(p.tier)+"<br><span class='mu'>"+esc(p.use)+"</span>")}${row("Marine Buy Score",p=>scoreChip(p.id))}${row("Price",p=>priceHtml(p.id))}${SPECS.map(([k,l])=>row(l,p=>esc(p.spec[k]||"Not provided"))).join("")}${row("Research sources",p=>{const n=SOURCES.filter(x=>x.p===p.id).length;return`${n} source${n==1?"":"s"} · <a href="${url(s,"/p/"+p.id)}">details</a>`})}</table></div>
 <p><button class="btn" id="cp">Copy shareable link</button> <span id="cpm" class="mu" role="status"></span></p>`;
 $("#cp").onclick=()=>{navigator.clipboard?.writeText(location.href).then(()=>$("#cpm").textContent="Link copied.",()=>$("#cpm").textContent="Copy failed; copy the address bar URL.")}}
function renderAbout(){$("#app").innerHTML=`<h1>How these jackets were selected</h1><p>The ${PRODUCTS.length} products are the owner's own shortlist for this prototype. This is not a market survey and does not cover all brands or models.</p><ul><li>Prices appear only where they were read from the retailer page on the stated date; otherwise “Check price at retailer”.</li><li>Missing specifications read “Not provided”. Gill and Musto figures are the brands' own claims on different scales and are not directly comparable.</li><li>The Marine Buy Score blends a spec score and independent feedback using the published formula on each product page. Brand-hosted star ratings are shown separately and excluded from the score. Jackets without enough independent feedback stay unrated.</li><li>Product photos are authorized by the site owner for demo purposes.</li><li>Likes are private: they are saved only in this browser (localStorage), never sent to our server, and never counted publicly. Clearing your browser data removes them.</li></ul>`}
// Compact Likes tray: hidden on My Likes and Compare, which already show the same controls.
function tray(s){const n=Likes.count(),sel=Likes.selected(),m=sel.length;
 $("#tray").innerHTML=n&&!["/likes","/compare"].includes(s.path)&&!Accounts.isAccountPath(s.path)?`<div class="tray" role="region" aria-label="My Likes summary">${HEART}<span><strong>${n} liked</strong>${m?` · ${m} selected for comparison`:""}</span><a class="btn" href="#/likes">Open My Likes</a>${m>=2?`<a class="btn p" href="${url({...s,cmp:sel},"/compare")}">Compare selected (${m})</a>`:""}</div>`:""}
function render(){const s=parse();confirmClear=false;$("#app").classList.remove("workspace-main");if(s.path==="/likes")Likes.ensureSelection();document.querySelector("#q").value=s.q;
 const acct=Accounts.isAccountPath(s.path);document.body.classList.toggle("auth-mode",acct&&!Accounts.current());document.body.classList.toggle("hub-mode",acct&&!!Accounts.current()&&s.path.startsWith("/profile"));if(acct)$("#app").innerHTML=Accounts.render(s.path);else if(s.path==="/compare")renderCompare(s);else if(s.path==="/likes")renderLikes(s);else if(s.path.startsWith("/p/"))renderProduct(s,s.path.slice(3));else if(s.path==="/about")renderAbout();else renderList(s);
 s.path==="/likes"?$("#nav-likes").setAttribute("aria-current","page"):$("#nav-likes").removeAttribute("aria-current");
 $("#nav-account").innerHTML=Accounts.navHtml();Accounts.isAccountPath(s.path)?$("#nav-account").setAttribute("aria-current","page"):$("#nav-account").removeAttribute("aria-current");Hub.afterRender(s.path);
 tray(s);if(pendingFocus){const f=$(pendingFocus)||$("h1");pendingFocus=null;f?.focus()}}
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const d=t.dataset;
 if(Accounts.handleClick(e)||Hub.handleClick(e))return;
 if(d.gal){const g=t.closest(".gal");return galGo(g,galIdx(g.querySelector(".gal-track"))+ +d.gal)}
 if(d.galGo)return galGo(t.closest(".gal"),+d.galGo);
 if("lbOpen" in d){const g=t.closest(".gal");return openLightbox(g,galIdx(g.querySelector(".gal-track")),t)}
 if("lbClose" in d)return $("#lb").close();
 if(d.like)return onLike(t);
 if(d.unlike){const all=[...document.querySelectorAll("[data-unlike]")],i=all.indexOf(t),nx=all[i+1]||all[i-1],p=P(d.unlike);
  pendingFocus=nx?`[data-unlike="${CSS.escape(nx.dataset.unlike)}"]`:"#lk-h";Likes.remove(d.unlike);live(`${pname(p)} removed from My Likes. ${Likes.count()} saved.`);return}
 if(d.uncmp){const s=parse(),c=s.cmp.filter(x=>x!==d.uncmp),all=[...document.querySelectorAll("[data-uncmp]")],i=all.indexOf(t),nx=all[i+1]||all[i-1];
  pendingFocus=c.length>=2&&nx?`[data-uncmp="${CSS.escape(nx.dataset.uncmp)}"]`:"#cmp-h";Likes.setSelected(d.uncmp,false);
  live(`${pname(P(d.uncmp))} removed from this comparison.${Likes.has(d.uncmp)?" It is still in My Likes.":""}`);go({cmp:c});return}
 if(t.id==="cmp-go")go({cmp:Likes.selected()},"/compare");
 else if(t.id==="sel-clr"){pendingFocus="[data-sel]";Likes.clearSelection()}
 else if(t.id==="rs"){confirmClear=true;rerenderLikes("#rs-no")}
 else if(t.id==="rs-no"){confirmClear=false;rerenderLikes("#rs")}
 else if(t.id==="rs-yes"){confirmClear=false;pendingFocus="#lk-h";Likes.clearAll();live("My Likes cleared.")}});
document.addEventListener("change",e=>{Accounts.handleChange(e);Hub.handleChange(e);const c=e.target;if(!c.dataset?.sel)return;
 if(!Likes.setSelected(c.dataset.sel,c.checked)){c.checked=false;live(`You can compare up to ${Likes.MAX_CMP} jackets. Unselect one first.`)}});
document.addEventListener("submit",e=>{Accounts.handleSubmit(e);Hub.handleSubmit(e)});
document.addEventListener("input",e=>{Accounts.handleInput(e);Hub.handleInput(e)});
$("#sf").addEventListener("submit",e=>{e.preventDefault();go({q:$("#q").value.trim()},"/")});
Workspace.start();addEventListener("hashchange",render);init();
window.rvf=rvf;
