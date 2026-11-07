import {STAGES,FILTER_DEFAULTS,filterFields,selectJobs,mergeFeed,jobsCsv,isTracked} from "./model.js";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const dateLabel=value=>value?new Date(value).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"Not provided";
const money=value=>Number.isFinite(value)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value):"Not provided";
const PAGE_SIZE=30;
const PORT_BASE="__PORT_5004__";
const feedUrl=()=>PORT_BASE.startsWith("__PORT_")?"/api/jobs":new URL(`${PORT_BASE}/api/jobs`,document.baseURI).href;
let jobs=[],snapshot=null,loading=false,feedError="",downloadUrl=null;
let state={...FILTER_DEFAULTS,sort:"company",view:"cards",tab:"jobs",page:1};
let fields=filterFields([]);

function showDialog(id){$(id).showModal();}
function closeDialog(id){$(id).close();}
function safeUrl(value){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function sourceBadge(j){
  return j.retained?"Retained for recheck":j.availability==="source_recheck_failed"?"Source recheck failed":"Employer listed";
}
function card(j,index){
  const facts=[
    ["Structured pay",j.payText||"No structured pay range in this feed; check the full posting"],
    ["Published location",j.location],
    ["Workplace evidence",`${j.workplace} · ${j.workplaceBasis}`],
    ["Job type",j.employment],
    ["Seniority signal",`${j.level} · ${j.levelBasis}`],
    ["Employer sector",`${j.industry} · curated grouping`],
    ["Business travel",Number.isFinite(j.travelPercent)?`${j.travelPercent}% maximum · ${j.travelEvidence}`:"Not specified"],
    ["Interview steps",Number.isFinite(j.interviewSteps)?`${j.interviewSteps} · ${j.interviewEvidence}`:"Not specified"],
    ["Last source check",dateLabel(j.checkedAt)],
    ["Published date",dateLabel(j.postedAt)]
  ];
  return `<details class="job demo-card" id="job-${esc(j.id)}" data-testid="card-${esc(j.id)}">
    <summary data-testid="expand-${esc(j.id)}"><div class="jobhead"><span class="rank">${String(index+1).padStart(2,"0")}</span><div>
      <div class="title">${esc(j.company)} <span class="company">· ${esc(j.role)}</span></div>
      <div class="pillrow"><span class="pill">${esc(j.career)}</span><span class="pill">${esc(j.workplace)}</span><span class="pill ${j.retained?"":"strong"}">${esc(sourceBadge(j))}</span><span class="pill">${esc(j.source)}</span></div>
      <div class="meta">${esc(j.payText||"Structured pay not provided; check posting")}</div><div class="meta">${esc(j.location)}</div>
    </div><div class="jobactions"><button data-favorite="${esc(j.id)}" aria-pressed="${j.favorite}" data-testid="favorite-${esc(j.id)}">${j.favorite?"Saved job":"Save job"}</button>
    <select data-stage="${esc(j.id)}" aria-label="Application stage for ${esc(j.company)}" data-testid="stage-${esc(j.id)}">${STAGES.map(stage=>`<option${stage===j.stage?" selected":""}>${esc(stage)}</option>`).join("")}</select>
    <a class="button" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener noreferrer" data-testid="posting-${esc(j.id)}">View employer posting</a></div></div></summary>
    <div class="details"><section class="subpanel"><h2>Source evidence</h2><div class="grid">${facts.map(([label,value])=>`<div class="fact"><b>${esc(label)}</b><div>${esc(value)}</div></div>`).join("")}</div>
    ${j.salaryNote?`<p class="small">${esc(j.salaryNote)}</p>`:""}<p class="small">Remote does not mean eligible everywhere. Confirm state/country restrictions, required credentials and the complete description with the employer.</p></section>
    <section class="subpanel"><h2>Employer excerpt</h2><p class="feed-excerpt">${esc(j.excerpt||"No description excerpt was supplied.")}</p><p class="small">This is an excerpt, not the complete posting. No personal resume match has been assessed here.</p></section>
    <section class="subpanel"><h2>My application workflow</h2><div class="workflow">
      <div class="field"><label for="action-${esc(j.id)}">Next action</label><input id="action-${esc(j.id)}" data-field="nextAction" data-id="${esc(j.id)}" maxlength="1500" value="${esc(j.nextAction)}" data-testid="action-${esc(j.id)}"></div>
      <div class="field"><label for="notes-${esc(j.id)}">Notes in this tab</label><textarea id="notes-${esc(j.id)}" data-field="notes" data-id="${esc(j.id)}" maxlength="5000" data-testid="notes-${esc(j.id)}">${esc(j.notes)}</textarea></div>
      <div class="field"><label for="applied-${esc(j.id)}">Applied date</label><input type="date" id="applied-${esc(j.id)}" data-field="appliedAt" data-id="${esc(j.id)}" value="${esc(j.appliedAt)}" data-testid="applied-${esc(j.id)}"></div>
      <div class="field"><label for="followup-${esc(j.id)}">Follow-up date</label><input type="date" id="followup-${esc(j.id)}" data-field="followUpAt" data-id="${esc(j.id)}" value="${esc(j.followUpAt)}" data-testid="followup-${esc(j.id)}"></div>
    </div></section></div></details>`;
}

function setupFields(){
  fields=filterFields(jobs);
  $("advancedFields").innerHTML=fields.slice(3).map(f=>`<div class="demo-filter-field"><label for="${f.key}">${esc(f.label)}</label><select id="${f.key}" data-testid="filter-${f.key}"></select></div>`).join("");
  for(const f of fields){
    const control=$(f.key),options=[[f.default??"",f.all],...f.options];
    if(!options.some(([value])=>String(value)===String(state[f.key])))options.push([state[f.key],state[f.key]]);
    control.innerHTML=options.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join("");
    control.value=String(state[f.key]);
    control.onchange=()=>{state[f.key]=control.value;state.page=1;render();};
  }
}
function syncControls(){
  $("demoSearch").value=state.query;
  for(const f of fields)$(f.key).value=String(state[f.key]);
}
function extraFilters(open){
  $("demoAdvancedFilters").hidden=!open;$("demoMoreFilters").setAttribute("aria-expanded",String(open));
  disclosureLabel();
}
function disclosureLabel(){
  const active=fields.slice(3).filter(f=>String(state[f.key])!==(f.default??"")).length;
  $("demoMoreFilters").textContent=($("demoAdvancedFilters").hidden?"More filters":"Hide extra filters")+(active?` · ${active} active`:"");
}
function clearFilters(){
  state={...state,...FILTER_DEFAULTS,sort:"company",page:1};$("demoSort").value="company";syncControls();render();
}
function openJob(id){
  clearFilters();state.tab="jobs";state.view="cards";
  const index=selectJobs(jobs,state).findIndex(j=>j.id===id);state.page=Math.max(1,Math.floor(index/PAGE_SIZE)+1);
  render();const detail=$(`job-${id}`);if(detail){detail.open=true;detail.scrollIntoView({block:"start"});}
}
function activeFilters(counts){
  const out=[];
  if(state.query.trim())out.push({key:"query",label:`Search: ${state.query.trim()}`});
  for(const f of fields)if(String(state[f.key])!==(f.default??"")){
    const label=f.options.find(([v])=>String(v)===String(state[f.key]))?.[1]??state[f.key];
    out.push({key:f.key,label:`${f.label}: ${label}`});
  }
  if(state.filter!=="all")out.push({key:"filter",label:`Shortcut: ${counts.find(c=>c[2]===state.filter)?.[0]}`});
  return out;
}
function renderSources(){
  $("sourceLedger").innerHTML=snapshot?snapshot.sources.map(s=>`<section class="subpanel"><h3>${esc(s.company)} · ${esc(s.provider)}</h3><p><strong>${esc(s.status)}</strong> · ${s.status==="ok"?`${s.count} listings returned${s.excluded?` · ${s.excluded} excluded/unlisted/duplicate`:""}`:s.checkedAt?`${s.count} older listings retained; the latest check failed`:"No successful response; listing count is unknown"}</p><p class="small">Last successful check: ${esc(dateLabel(s.checkedAt))} · Last attempt: ${esc(dateLabel(s.attemptedAt))}${s.error?` · ${esc(s.error)}`:""}</p><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" data-testid="source-${esc(s.id)}">Open employer feed</a></section>`).join(""):"The first source check has not completed.";
}
function render(){
  const opened=[...document.querySelectorAll(".demo-card[open]")].map(e=>e.id),items=selectJobs(jobs,state);
  const counts=[["All roles",jobs.length,"all"],["Remote",jobs.filter(j=>j.workplace==="Remote").length,"remote"],
    ["Posted salary",jobs.filter(j=>j.payText).length,"salary"],["Active applications",jobs.filter(j=>["Applied","Interviewing","Offer"].includes(j.stage)).length,"pipeline"],
    ["Saved jobs",jobs.filter(j=>j.favorite).length,"favorite"],["Interviewing",jobs.filter(j=>j.stage==="Interviewing").length,"interviewing"]];
  $("demoKpis").innerHTML=counts.map(([label,value,key])=>`<button class="kpi ${state.filter===key?"active":""}" data-filter="${key}" aria-pressed="${state.filter===key}" data-testid="quick-${key}"><b>${loading&&!snapshot?"…":value}</b><span>${label}</span></button>`).join("");
  const active=activeFilters(counts);
  $("filterSummary").textContent=active.length?`${active.length} active filter${active.length===1?"":"s"}. All conditions must match.`:"All departments, employers and workplaces";
  $("demoActiveFilters").innerHTML=active.map(({key,label})=>`<button class="demo-filter-chip" data-remove-filter="${key}" aria-label="Remove ${esc(label)}" data-testid="remove-filter-${key}">${esc(label)} <span class="demo-chip-clear">Clear</span></button>`).join("");
  $("demoOptionsBtn").textContent=`Filters & views${active.length?` (${active.length})`:""}`;disclosureLabel();
  $("refreshBtn").disabled=loading;$("retryFeed").disabled=loading;$("exportBtn").disabled=!jobs.length;
  $("feedError").hidden=!feedError;$("feedErrorText").textContent=feedError;
  if(loading)$("feedStatus").textContent=snapshot?"Rechecking the employer feeds; your current workflow is preserved.":"Connecting to the configured employer ATS feeds…";
  else if(snapshot){const ok=snapshot.sources.filter(s=>s.status==="ok").length;
    $("feedStatus").textContent=`${snapshot.jobs.length} employer listings · ${ok}/${snapshot.sources.length} sources checked successfully · ${snapshot.cached?"cached check":"checked"} ${dateLabel(snapshot.checkedAt)}${snapshot.status==="complete"?"":" · Some sources need rechecking"}${snapshot.truncated?" · Feed safety limit reached":""}`;
  }else $("feedStatus").textContent="No employer feed has been loaded.";
  for(const [id,tab] of [["jobsTab","jobs"],["demoPipelineTab","pipeline"]]){
    $(id).setAttribute("aria-selected",String(state.tab===tab));$(id).tabIndex=state.tab===tab?0:-1;
  }
  $("jobsPanel").hidden=state.tab!=="jobs";$("pipelinePanel").hidden=state.tab!=="pipeline";
  $("demoView").textContent=state.view==="cards"?"Table view":"Card view";
  $("demoResultCount").textContent=loading&&!snapshot?"Loading employer listings…":`${items.length} matching of ${jobs.length} loaded roles`;
  const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));state.page=Math.min(state.page,pages);
  const start=(state.page-1)*PAGE_SIZE,shown=items.slice(start,start+PAGE_SIZE);
  if(loading&&!snapshot)$("demoJobList").innerHTML='<div class="empty">Checking actual employer APIs. No replacement listings are generated.</div>';
  else if(!items.length)$("demoJobList").innerHTML=`<div class="empty"><h2>${feedError&&!jobs.length?"The feed is unavailable":"No roles match these conditions"}</h2><p>${feedError&&!jobs.length?"Check the source ledger or retry the feed.":"Try fewer filters. Missing pay, travel or interview values do not pass a numeric requirement."}</p><button data-clear data-testid="empty-clear">Clear filters</button></div>`;
  else if(state.view==="cards")$("demoJobList").innerHTML=shown.map((j,i)=>card(j,start+i)).join("");
  else $("demoJobList").innerHTML=`<div class="tablewrap demo-table-wrap"><table class="datatable demo-table"><thead><tr><th>Employer / role</th><th>Location</th><th>Published pay</th><th>My stage</th><th>Details</th></tr></thead><tbody>${shown.map(j=>`<tr data-testid="row-${esc(j.id)}"><td><strong>${esc(j.company)}</strong><div>${esc(j.role)}</div><span class="small">${esc(sourceBadge(j))}</span></td><td>${esc(j.location)}<div class="small">${esc(j.workplace)}</div></td><td>${esc(j.payText||"Not provided")}</td><td>${esc(j.stage)}</td><td><button data-open="${esc(j.id)}" data-testid="table-open-${esc(j.id)}">Open</button></td></tr>`).join("")}</tbody></table></div>`;
  for(const id of opened){const el=$(id);if(el)el.open=true;}
  $("pager").hidden=!items.length||state.tab!=="jobs";$("previousPage").disabled=state.page<=1;$("nextPage").disabled=state.page>=pages;
  $("pageInfo").textContent=`${start+1}–${start+shown.length} of ${items.length} · Page ${state.page}/${pages}`;
  $("demoPipeline").innerHTML=`<p class="source-note">Current filters apply. Workflow is private to this tab; export it before reloading.</p><div class="demo-pipeline">${["Applied","Interviewing","Offer","Rejected"].map(stage=>{
    const stageJobs=items.filter(j=>j.stage===stage);
    return `<section class="column"><h2>${stage} / ${stageJobs.length}</h2>${stageJobs.map(j=>`<button class="pipeline-card" data-open="${esc(j.id)}" data-testid="pipeline-${esc(j.id)}"><strong>${esc(j.company)}</strong><span>${esc(j.role)}</span><span class="small">${esc(j.nextAction||"Add your next action")}</span>${j.retained?'<span class="small">Retained; availability needs rechecking</span>':""}</button>`).join("")||'<p class="small">No matching roles in this stage.</p>'}</section>`;
  }).join("")}</div>`;
  renderSources();
}

async function loadFeed(){
  if(loading)return;loading=true;feedError="";render();
  try{
    const response=await fetch(feedUrl(),{method:"GET",headers:{Accept:"application/json"},credentials:"omit"});
    const data=await response.json();
    if(!response.ok&&!Array.isArray(data.jobs))throw new Error(data.error||"The employer feeds could not be checked.");
    if(!Array.isArray(data.jobs)||!Array.isArray(data.sources)||data.jobs.some(j=>!j.id||!j.company||!j.role||!safeUrl(j.url)))throw new Error("The feed response did not pass validation.");
    jobs=mergeFeed(data.jobs,jobs,data.sources);snapshot=data;
    if(!response.ok||data.status==="unavailable")feedError="No source could be freshly checked. Any older records are clearly marked for rechecking; no fictional replacements are used.";
    setupFields();state.page=1;
  }catch(error){
    feedError=`${error.message} Your existing tab workflow has not been erased.`;
    jobs=jobs.map(j=>({...j,availability:"source_recheck_failed"}));
  }finally{loading=false;render();}
}

document.addEventListener("click",event=>{
  const b=event.target.closest("button,a");if(!b)return;
  if(b.dataset.close){closeDialog(b.dataset.close);return;}
  if(b.dataset.filter){state.filter=b.dataset.filter;state.tab="jobs";state.page=1;render();return;}
  if(b.dataset.tab){state.tab=b.dataset.tab;render();return;}
  if(Object.hasOwn(FILTER_DEFAULTS,b.dataset.removeFilter)){const key=b.dataset.removeFilter;state[key]=FILTER_DEFAULTS[key];state.page=1;syncControls();render();return;}
  if(b.hasAttribute("data-clear")){clearFilters();return;}
  if(b.dataset.open){openJob(b.dataset.open);return;}
  if(b.dataset.favorite){
    event.preventDefault();const job=jobs.find(j=>j.id===b.dataset.favorite);if(!job)return;
    job.favorite=!job.favorite;if(job.favorite&&job.stage==="Not tracked")job.stage="Saved";render();
  }
});
document.addEventListener("change",event=>{
  const id=event.target.dataset.stage;if(!id||!STAGES.includes(event.target.value))return;
  const job=jobs.find(j=>j.id===id);if(!job)return;job.stage=event.target.value;
  if(job.stage==="Applied"&&!job.appliedAt){const d=new Date();job.appliedAt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  render();
});
document.addEventListener("input",event=>{
  const {field,id}=event.target.dataset;
  if(!["notes","nextAction","appliedAt","followUpAt"].includes(field))return;
  const job=jobs.find(j=>j.id===id);if(job)job[field]=event.target.value;
});
$("demoSearch").oninput=e=>{state.query=e.target.value;state.page=1;render();};
$("demoSort").onchange=e=>{state.sort=e.target.value;state.page=1;render();};
$("demoView").onclick=()=>{state.view=state.view==="cards"?"table":"cards";render();};
$("clearDemoFilters").onclick=clearFilters;
$("demoMoreFilters").onclick=()=>extraFilters($("demoAdvancedFilters").hidden);
$("demoOptionsBtn").onclick=()=>{
  const open=$("demoOptionsBtn").getAttribute("aria-expanded")!=="true";
  $("demoOptionsBtn").setAttribute("aria-expanded",String(open));document.querySelector(".toolbar").classList.toggle("expanded",open);
  if(matchMedia("(max-width:700px)").matches)extraFilters(open);
};
$("previousPage").onclick=()=>{state.page=Math.max(1,state.page-1);render();$("demoResultCount").scrollIntoView({block:"start"});};
$("nextPage").onclick=()=>{state.page++;render();$("demoResultCount").scrollIntoView({block:"start"});};
$("refreshBtn").onclick=loadFeed;$("retryFeed").onclick=loadFeed;
$("sourcesBtn").onclick=()=>{renderSources();showDialog("sourcesDialog");};
$("guideBtn").onclick=()=>showDialog("guideDialog");
$("resetBtn").onclick=()=>showDialog("resetDialog");
$("confirmDemoReset").onclick=()=>{jobs=mergeFeed(snapshot?.jobs??[],[],snapshot?.sources??[]);closeDialog("resetDialog");clearFilters();};
$("exportBtn").onclick=()=>{
  const csv=jobsCsv(jobs);$("demoCsv").value=csv;$("demoCopyStatus").textContent="";
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  $("downloadDemoCsv").href=downloadUrl;showDialog("demoExportDialog");
};
$("copyDemoCsv").onclick=async()=>{
  try{await navigator.clipboard.writeText($("demoCsv").value);$("demoCopyStatus").textContent="CSV copied.";}
  catch{$("demoCsv").focus();$("demoCsv").select();$("demoCopyStatus").textContent="Clipboard access was blocked. The CSV is selected for manual copying.";}
};
$("selectDemoCsv").onclick=()=>{$("demoCsv").focus();$("demoCsv").select();};
const tabs=[$("jobsTab"),$("demoPipelineTab")];
tabs.forEach((tab,index)=>tab.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowLeft"?-1:1)+tabs.length)%tabs.length;
  tabs[next].click();tabs[next].focus();
}));
setupFields();render();loadFeed();
