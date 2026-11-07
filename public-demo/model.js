export const STAGES=["Not tracked","Saved","Applied","Interviewing","Offer","Rejected"];
export const FILTER_DEFAULTS=Object.freeze({query:"",career:"",workplace:"",payFloor:"0",level:"",employment:"",industry:"",region:"",employer:"",travelCap:"",interviewCap:"",stage:"",age:"",availability:"",filter:"all"});
export const WORKFLOW_FIELDS=["stage","favorite","notes","nextAction","appliedAt","followUpAt"];
const defaults=()=>({stage:"Not tracked",favorite:false,notes:"",nextAction:"",appliedAt:"",followUpAt:""});
export const isTracked=j=>Boolean(j.favorite||j.stage&&j.stage!=="Not tracked"||j.notes||j.nextAction||j.appliedAt||j.followUpAt);
const cap=(value,limit)=>limit===""?true:limit==="unknown"?!Number.isFinite(value):Number.isFinite(value)&&value<=Number(limit);
const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(v=>[v,v]);

export function mergeFeed(incoming,previous=[],sources=[]){
  const old=new Map(previous.map(j=>[j.id,j]));
  const sourceStatus=new Map(sources.map(s=>[s.id,s.status]));
  const jobs=incoming.map(raw=>{
    const prior=old.get(raw.id),workflow=defaults();
    if(prior)for(const key of WORKFLOW_FIELDS)if(Object.hasOwn(prior,key))workflow[key]=prior[key];
    old.delete(raw.id);return {...raw,...workflow,retained:false};
  });
  for(const prior of old.values())if(isTracked(prior))jobs.push({...prior,retained:true,
    availability:sourceStatus.get(prior.sourceId)==="ok"?"not_in_latest_feed":"source_recheck_failed"});
  return jobs;
}

export function filterFields(jobs){
  return [
    {key:"career",label:"Department",all:"All departments",options:unique(jobs.map(j=>j.career))},
    {key:"workplace",label:"Workplace",all:"Any workplace",options:unique(jobs.map(j=>j.workplace))},
    {key:"payFloor",label:"Annual USD minimum",all:"No pay filter",default:"0",options:[["70000","$70,000+"],["90000","$90,000+"],["110000","$110,000+"],["150000","$150,000+"],["unknown","Annual USD minimum unknown"]]},
    {key:"level",label:"Title-level signal",all:"Any title level",options:unique(jobs.map(j=>j.level))},
    {key:"employment",label:"Job type",all:"Any job type",options:unique(jobs.map(j=>j.employment))},
    {key:"industry",label:"Employer sector",all:"Any sector grouping",options:unique(jobs.map(j=>j.industry))},
    {key:"region",label:"Country stated",all:"Any stated country",options:[...unique(jobs.flatMap(j=>j.region??[])),["unknown","Not stated"]]},
    {key:"employer",label:"Employer",all:"Any employer",options:unique(jobs.map(j=>j.company))},
    {key:"travelCap",label:"Business travel",all:"Any / not specified",options:[["0","No travel explicitly stated"],["10","Stated maximum 10%"],["25","Stated maximum 25%"],["unknown","Not specified"]]},
    {key:"interviewCap",label:"Interview steps stated",all:"Any / not specified",options:[["2","2 steps or fewer"],["3","3 steps or fewer"],["4","4 steps or fewer"],["unknown","Not specified"]]},
    {key:"stage",label:"My application status",all:"Any application status",options:STAGES.map(s=>[s,s])},
    {key:"age",label:"Published date",all:"Any / not provided",options:[["7","Within 7 days"],["30","Within 30 days"],["unknown","Not provided"]]},
    {key:"availability",label:"Feed / history",all:"Loaded + retained",options:[["current","Successfully checked feed"],["retained","Retained workflow only"]]}
  ];
}

export function selectJobs(jobs,state={},now=Date.now()){
  const f={...FILTER_DEFAULTS,...state},text=f.query.trim().toLowerCase();
  return jobs.filter(j=>{
    const age=j.postedAt?(now-Date.parse(j.postedAt))/86400000:null;
    return (!f.career||j.career===f.career)&&(!f.workplace||j.workplace===f.workplace)&&
      (!f.level||j.level===f.level)&&(!f.employment||j.employment===f.employment)&&
      (!f.industry||j.industry===f.industry)&&(!f.employer||j.company===f.employer)&&
      (!f.region||(f.region==="unknown"?!j.region?.length:j.region?.includes(f.region)))&&
      (!f.stage||j.stage===f.stage)&&cap(j.travelPercent,f.travelCap)&&cap(j.interviewSteps,f.interviewCap)&&
      (f.payFloor==="unknown"?!Number.isFinite(j.min):Number(f.payFloor)>0?Number.isFinite(j.min)&&j.min>=Number(f.payFloor):true)&&
      (!f.age||(f.age==="unknown"?age===null:age!==null&&age>=0&&age<=Number(f.age)))&&
      (!f.availability||(f.availability==="retained"?j.retained:!j.retained&&j.availability==="employer_listed"))&&
      (!text||[j.company,j.role,j.career,j.location,j.industry,j.excerpt,j.notes,j.nextAction].join(" ").toLowerCase().includes(text))&&
      (f.filter==="all"||f.filter==="remote"&&j.workplace==="Remote"||f.filter==="salary"&&Boolean(j.payText)||
        f.filter==="pipeline"&&["Applied","Interviewing","Offer"].includes(j.stage)||
        f.filter==="favorite"&&j.favorite||f.filter==="interviewing"&&j.stage==="Interviewing");
  }).sort((a,b)=>{
    if(f.sort==="pay")return (b.min??-Infinity)-(a.min??-Infinity)||a.company.localeCompare(b.company);
    if(f.sort==="posted")return (Date.parse(b.postedAt)||0)-(Date.parse(a.postedAt)||0)||a.company.localeCompare(b.company);
    if(f.sort==="role")return a.role.localeCompare(b.role)||a.company.localeCompare(b.company);
    return a.company.localeCompare(b.company)||a.role.localeCompare(b.role);
  });
}

export function jobsCsv(jobs){
  const columns=["job_id","company","role","department","workplace","location","annual_min_usd","annual_max_usd","published_pay_text","source","posting_url","feed_checked_at","published_at","availability","stage","favorite","applied_date","follow_up_date","next_action","notes","title_level_signal","job_type","sector_group","travel_max_percent","interview_steps"];
  const quote=value=>{let s=String(value??"");if(/^[\s\u0000-\u001f]*[=+\-@]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return "\ufeff"+[columns.map(quote).join(","),...jobs.map(j=>[
    j.id,j.company,j.role,j.career,j.workplace,j.location,j.min,j.max,j.payText,j.source,j.url,j.checkedAt,j.postedAt,
    j.availability,j.stage,j.favorite,j.appliedAt,j.followUpAt,j.nextAction,j.notes,j.level,j.employment,j.industry,j.travelPercent,j.interviewSteps
  ].map(quote).join(","))].join("\r\n");
}
