import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {validateSnapshot,validateProfile,profileEquivalent,WEIGHT_KEYS,WORKFLOW_FIELDS,allJobs,hasOwn} from "../src/domain.mjs";

const requestSchema=JSON.parse(readFileSync(new URL("../schemas/job-tracker-refresh-request.schema.json",import.meta.url),"utf8"));
const ajv=new Ajv({allErrors:true,strict:false,ownProperties:true});addFormats(ajv);
const requestCheck=ajv.compile(requestSchema);
const timestampCheck=ajv.compile({type:"string",format:"date-time"});
const demand=(condition,message)=>{if(!condition)throw new Error(message);};
const https=value=>{try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}};
const stamp=value=>timestampCheck(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function validateAgentOutput(snapshot,{request=null,resumeFiles={},now=Date.now()}={}){
  validateSnapshot(snapshot);
  demand(snapshot.generator==="Perplexity","Agent output must identify Perplexity, not a demonstration generator.");
  demand(["complete","partial"].includes(snapshot.run_status),"The run needs an explicit complete/partial outcome.");
  demand(stamp(snapshot.run_started_at)&&Date.parse(snapshot.run_started_at)<=now+300000,"A valid run_started_at timestamp is required.");
  const started=Date.parse(snapshot.run_started_at);
  const aliases=new Set(snapshot.profile.resumes.map(r=>r.alias));
  const urls=new Set();
  for(const job of snapshot.leads){
    demand(https(job.url),`Lead ${job.job_id} needs an exact safe HTTPS posting URL.`);
    demand(!/(?:^|\.)example\.(?:com|org|net)$/.test(new URL(job.url).hostname)&&!/\b(?:fictional|sample employer|example employer)\b/i.test(job.company)&&!/^(?:synthetic fixture|demo only)$/i.test(job.source),`Known demonstration markers are not real lead evidence for ${job.job_id}.`);
    demand(!urls.has(job.url),`Duplicate canonical posting URL for ${job.job_id}.`);urls.add(job.url);
    demand(job.verification_status==="active"&&stamp(job.verified_at),`Lead ${job.job_id} lacks active timestamped verification.`);
    demand(Date.parse(job.verified_at)<=now+300000,`Future verification timestamp for ${job.job_id}.`);
    demand(Date.parse(job.verified_at)>=started,`Lead ${job.job_id} was checked outside the current run.`);
    demand(aliases.has(job.resume),`Unknown actual-resume alias for ${job.job_id}.`);
    demand(job.score>=snapshot.profile.minimumScore,`Lead ${job.job_id} is below the configured fit threshold.`);
    if(snapshot.profile.salaryFloor>0)demand(Number.isFinite(job.pay_min)&&job.pay_min>=snapshot.profile.salaryFloor,`Lead ${job.job_id} does not establish the required posted annual USD floor.`);
    demand(job.score_components?.length===8&&new Set(job.score_components.map(c=>c.component)).size===8,`Eight unique score components are required for ${job.job_id}, including partial runs.`);
    let raw=0;
    for(const c of job.score_components){
      demand(WEIGHT_KEYS.includes(c.component)&&c.points_possible===snapshot.profile.weights[c.component]&&Number.isFinite(c.points_awarded)&&c.points_awarded>=0&&c.points_awarded<=c.points_possible&&c.evidence?.trim(),`Invalid component or missing evidence for ${job.job_id}.`);
      raw+=c.points_awarded;
    }
    demand(job.checklist?.length>0,`Requirement checklist missing for ${job.job_id}.`);
    if(hasOwn(job,"raw_score"))demand(Math.abs(job.raw_score-raw)<0.01,`Raw score does not reconcile for ${job.job_id}.`);
    if(hasOwn(job,"score_cap"))demand(Number.isFinite(job.score_cap)&&job.score_cap>=0&&job.score_cap<=100&&job.cap_reason?.trim(),`Missing or invalid score cap explanation for ${job.job_id}.`);
    const final=Number.isFinite(job.score_cap)?Math.min(raw,job.score_cap):raw;
    demand(Math.abs(job.score-final)<0.01,`Final score does not reconcile for ${job.job_id}.`);
    demand(!Object.keys(job).some(k=>/^(?:offer_probability|hiring_probability|offerProbability|hiringProbability)$/.test(k)),`Unsupported hiring-probability field for ${job.job_id}.`);
  }
  const ledger=snapshot.sources.ledger;
  demand(Array.isArray(ledger),"sources.ledger must record every configured source attempt.");
  for(const item of ledger)demand(item?.source&&stamp(item.attempted_at)&&Date.parse(item.attempted_at)>=started&&Date.parse(item.attempted_at)<=now+300000&&["results","zero_qualifying","partial","blocked","failed"].includes(item.outcome), "Each source-ledger item needs source, current-run attempted_at and an explicit outcome.");
  const configured=request?.profile?.sources??snapshot.profile.sources;
  demand(configured.every(name=>ledger.some(item=>item.source===name)),"A configured source is missing from the attempt ledger.");
  const incomplete=snapshot.sources.unavailable.length>0||ledger.some(item=>["partial","blocked","failed"].includes(item.outcome));
  demand(!incomplete||snapshot.run_status==="partial","Incomplete source coverage cannot be called complete.");
  const historicalArchives=new Map((request?.priorSnapshot?.archived??[]).map(j=>[j.job_id,j]));
  for(const job of snapshot.archived){
    const old=historicalArchives.get(job.job_id);
    if(old&&job.checked===old.checked&&job.reason===old.reason&&job.url===old.url)continue;
    demand(job.reason?.trim()&&stamp(job.checked)&&Date.parse(job.checked)>=started&&Date.parse(job.checked)<=now+300000&&https(job.url),`Archive ${job.job_id} needs current-run direct closure evidence and a check timestamp.`);
  }
  for(const job of allJobs(snapshot))for(const field of WORKFLOW_FIELDS){
    if(job.workflow&&hasOwn(job.workflow,field)&&hasOwn(job,field))demand(same(job.workflow[field],job[field]),`Top-level and workflow ${field} disagree for ${job.job_id}.`);
  }
  if(request){
    demand(requestCheck(request),"Refresh request does not match the current repository schema.");
    validateProfile(request.profile);
    demand(profileEquivalent(snapshot.profile,request.profile),"Output profile differs from the approved request.");
    demand(same(request.resumeHandling.descriptors,request.profile.resumes),"Request resume descriptors differ from the profile.");
    demand(request.resumeHandling.contentsIncluded===false,"Raw resume bodies must not be included.");
    const incoming=new Map(allJobs(snapshot).map(j=>[j.job_id,j]));
    const migrations=new Map((snapshot.id_migrations??[]).map(m=>[m.old_job_id,m.new_job_id]));
    for(const prior of request.priorWorkflow){
      const job=incoming.get(migrations.get(prior.jobId)??prior.jobId);
      if(!job)continue; // The private importer retains omitted tracked history.
      for(const field of WORKFLOW_FIELDS)if(hasOwn(prior,field)){
        const current=job.workflow&&hasOwn(job.workflow,field)?job.workflow[field]:job[field];
        demand(same(current,prior[field]),`Workflow ${field} changed for ${prior.jobId}; preserve the explicit exported value.`);
      }
    }
  }
  let fingerprintsChecked=0,resumeFilesChecked=0;
  for(const [id,path] of Object.entries(resumeFiles)){
    const descriptor=snapshot.profile.resumes.find(r=>r.id===id);
    demand(descriptor, "A supplied resume ID has no descriptor.");
    const info=statSync(path);demand(info.isFile()&&info.size<=25_000_000,"Resume path must be a file of at most 25 MB.");
    const bytes=readFileSync(path),hash=createHash("sha256").update(bytes).digest("hex");
    if(descriptor.sha256){demand(hash===descriptor.sha256,"An actual resume does not match its expected SHA-256 fingerprint.");fingerprintsChecked++;}
    if(descriptor.size!==null&&descriptor.size!==undefined)demand(info.size===descriptor.size,"An actual resume does not match its expected size.");
    resumeFilesChecked++;
  }
  return {valid:true,generator:snapshot.generator,runStatus:snapshot.run_status,leads:snapshot.leads.length,hidden:snapshot.hidden.length,archived:snapshot.archived.length,configuredSources:configured.length,resumeFilesChecked,fingerprintsChecked,requestCompared:!!request,
    limits:"Validation checks structure and consistency, not the truth of external evidence or whether document contents were actually assessed. Current workspace readback is still required after import."};
}

const usage=`Usage: node scripts/validate-agent-output.mjs --snapshot PRIVATE_RESULT.json [--request PRIVATE_REQUEST.json] [--resume DESCRIPTOR_ID=/private/resume.pdf ...]

Read-only: validates the current schema, profile, all eight score components,
run_started_at, verification timestamps, sources.ledger, caps and exported workflow preservation.
Optional --resume arguments compare original file bytes with supplied descriptors.
No network, import, file writes, publication or resume text extraction is performed.
Live evidence accuracy, actual-resume assessment, current-workflow conflict safety
and authenticated post-import readback remain separate required checks.

sources.ledger items: {source: EXACT_CONFIGURED_NAME, attempted_at: ISO_DATETIME,
outcome: results|zero_qualifying|partial|blocked|failed, evidence_url?: HTTPS_URL,
coverage?: TEXT}. An unavailable source requires run_status: partial.`;

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.includes("--help"))console.log(usage);
  else try{
    const options={resumeFiles:Object.create(null)};let snapshotPath;
    for(let i=0;i<args.length;i++){
      const flag=args[i],value=args[++i];demand(value,`Missing value for ${flag}.`);
      if(flag==="--snapshot")snapshotPath=value;
      else if(flag==="--request")options.request=JSON.parse(readFileSync(value,"utf8"));
      else if(flag==="--resume"){const at=value.indexOf("=");demand(at>0,"Use --resume DESCRIPTOR_ID=PATH.");options.resumeFiles[value.slice(0,at)]=value.slice(at+1);}
      else throw new Error(`Unknown argument ${flag}.`);
    }
    demand(snapshotPath,"--snapshot is required; use --help for usage.");
    const file=statSync(snapshotPath);demand(file.size<=10*1024*1024,"Snapshot exceeds the 10 MiB input limit.");
    console.log(JSON.stringify(validateAgentOutput(JSON.parse(readFileSync(snapshotPath,"utf8")),options),null,2));
  }catch(error){console.error(`Validation failed: ${error.message}`);process.exitCode=1;}
}
