import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizePosting,normalizeResponse,salaryFacts,screeningFacts,safePostingUrl,plainText,createFeedService} from "../src/live-feed.mjs";
import {mergeFeed,selectJobs,filterFields,jobsCsv} from "../public-demo/model.js";
import handler,{createJobsHandler} from "../api/jobs.mjs";

// Synthetic values exist only in this test module, never in a runtime bundle.
const checked="2026-11-06T12:00:00.000Z";
const source={id:"test-board",provider:"ashby",board:"test-board",company:"Test employer",sector:"Test sector",home:"https://example.org/careers"};
const posting=(extra={})=>({id:"test-role-1",title:"Senior Engineer",department:"Engineering",employmentType:"FullTime",
  location:"Remote, United States",isListed:true,isRemote:true,workplaceType:"Remote",
  address:{postalAddress:{addressCountry:"USA"}},publishedAt:"2026-11-01T09:00:00Z",
  jobUrl:"https://jobs.ashbyhq.com/test-board/test-role-1",descriptionPlain:"Build and review systems.",...extra});
const normalized=(extra={})=>normalizePosting(posting(extra),source,checked);
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}});

test("ATS rows are normalized with source identity, actual dates and no match score",()=>{
  const job=normalized();
  assert.equal(job.company,"Test employer");assert.equal(job.role,"Senior Engineer");
  assert.equal(job.region[0],"US");assert.equal(job.postedAt,"2026-11-01T09:00:00.000Z");
  assert.equal(job.checkedAt,checked);assert.equal(job.availability,"employer_listed");
  assert.equal(job.matchingStatus,"not_run");assert.equal(job.score,undefined);
  assert.equal(job.min,null);assert.equal(job.travelPercent,null);assert.equal(job.interviewSteps,null);
});
test("hybrid is never promoted to fully remote by Ashby's isRemote flag",()=>{
  const job=normalized({isRemote:true,workplaceType:"Hybrid",location:"San Francisco"});
  assert.equal(job.workplace,"Hybrid");
  assert.equal(normalized({isRemote:true,workplaceType:undefined,location:"San Francisco"}).workplace,"Not specified");
  assert.equal(normalized({workplaceType:undefined,location:"No remote option"}).workplace,"Not specified");
});
test("unlisted/prospect jobs and unsafe links are excluded",()=>{
  assert.equal(normalized({isListed:false}),null);
  assert.equal(normalized({jobUrl:"javascript:alert(1)"}),null);
  assert.equal(normalizePosting({id:1,title:"General interest",internal_job_id:null,absolute_url:"https://example.org/jobs/1"},{...source,provider:"greenhouse"},checked),null);
  assert.equal(safePostingUrl("https://name:secret@example.org/jobs"),null);
  assert.equal(safePostingUrl("https://127.0.0.1/jobs"),null);
});
test("canonical URLs remove tracking but preserve functional requisition identity",()=>{
  assert.equal(safePostingUrl("https://example.org/careers?gh_jid=123&utm_source=test#section"),"https://example.org/careers?gh_jid=123");
  assert.equal(safePostingUrl("https://careers.example.org/job?ref=123&source=456"),"https://careers.example.org/job?ref=123&source=456");
  const data=normalizeResponse({jobs:[posting(),posting({id:"duplicate-id"})]},source,checked);
  assert.equal(data.jobs.length,1);assert.equal(data.excluded,1);
  assert.throws(()=>normalizeResponse({unknown:[]},source,checked),/no jobs array/);
});
test("plain-text rendering decodes employer markup without executing it",()=>{
  assert.equal(plainText("&lt;p&gt;Role &amp; team&lt;/p&gt;<script>alert(1)</script>"),"Role & team");
});
test("annual USD bases exclude equity, hourly amounts and foreign currencies",()=>{
  const compensation={summaryComponents:[
    {compensationType:"Salary",interval:"1 YEAR",currencyCode:"USD",minValue:90000,maxValue:120000},
    {compensationType:"EquityPercentage",interval:"NONE",currencyCode:null,minValue:1,maxValue:3},
    {compensationType:"Salary",interval:"1 YEAR",currencyCode:"EUR",minValue:200000,maxValue:250000}
  ]};
  const facts=salaryFacts({compensation},"ashby");assert.equal(facts.min,90000);assert.equal(facts.max,120000);
  const hourly=salaryFacts({salaryRange:{currency:"USD",interval:"per-hour",min:45,max:60}},"lever");
  assert.equal(hourly.min,null);assert.match(hourly.payText,/per-hour/);
  const foreign=salaryFacts({compensation:{summaryComponents:[{compensationType:"Salary",interval:"1 YEAR",currencyCode:"EUR",minValue:100000,maxValue:120000}]}},"ashby");
  assert.equal(foreign.min,null);assert.equal(foreign.currency,"EUR");
  const noCurrency=salaryFacts({salaryRange:{interval:"year",min:1,max:2}},"lever");assert.match(noCurrency.payText,/currency not provided/);
});
test("travel and interview limits need explicit matching evidence",()=>{
  const known=screeningFacts("Engineer","Remote","Travel up to 10%. A 3-stage interview process.",null,null);
  assert.equal(known.travelPercent,10);assert.equal(known.interviewSteps,3);
  const unknown=screeningFacts("Engineer","Remote","Some travel may be needed. We have a thoughtful interview process.",null,null);
  assert.equal(unknown.travelPercent,null);assert.equal(unknown.interviewSteps,null);
  assert.equal(screeningFacts("Engineer","Remote","No business travel is required.",null,null).travelPercent,0);
  assert.equal(screeningFacts("Engineer","Remote","No travel reimbursement is available.",null,null).travelPercent,null);
  assert.equal(screeningFacts("Engineer","Remote","We do not use a 3-stage interview process.",null,null).interviewSteps,null);
  assert.equal(screeningFacts("Engineer","Remote","We don’t use a 3-stage interview process.",null,null).interviewSteps,null);
  assert.equal(screeningFacts("Engineer","Remote","Instead of a 3-stage interview process, we use 5 rounds.",null,null).interviewSteps,null);
  assert.equal(screeningFacts("Engineer","Remote","Travel is not required except for customer meetings.",null,null).travelPercent,null);
  assert.equal(screeningFacts("Engineer","Remote","A minimum 3-stage interview process.",null,null).interviewSteps,null);
});
test("the source service caches checks and shares one concurrent refresh",async()=>{
  let time=Date.parse(checked),calls=0;
  const service=createFeedService({sources:[source],now:()=>time,ttl:1000,fetchImpl:async()=>{calls++;return response({jobs:[posting()]});}});
  const [a,b]=await Promise.all([service.get(),service.get()]);assert.equal(calls,1);assert.equal(a.jobs.length,1);assert.equal(b.jobs.length,1);
  time+=100;const cached=await service.get();assert.equal(cached.cached,true);assert.equal(cached.checkedAt,a.checkedAt);assert.equal(calls,1);
  time+=1000;await service.get();assert.equal(calls,2);
});
test("an upstream failure is not an empty successful source or a fictional fallback",async()=>{
  let time=Date.parse(checked),fail=false;
  const service=createFeedService({sources:[source],now:()=>time,ttl:1,fetchImpl:async()=>fail?new Response("Unavailable",{status:503}):response({jobs:[posting()]})});
  const first=await service.get();fail=true;time+=2;const second=await service.get();
  assert.equal(second.sources[0].status,"stale");assert.equal(second.jobs[0].availability,"source_recheck_failed");
  assert.equal(second.jobs[0].checkedAt,first.jobs[0].checkedAt);
  const unavailable=createFeedService({sources:[source],fetchImpl:async()=>new Response("Unavailable",{status:503})});
  const empty=await unavailable.get();assert.equal(empty.status,"unavailable");assert.deepEqual(empty.jobs,[]);assert.equal(empty.sources[0].status,"unavailable");assert.equal(empty.sources[0].count,null);
  assert.equal(selectJobs(mergeFeed(second.jobs),{availability:"current"}).length,0);
});
test("partial coverage retains both successful-source rows and failure evidence",async()=>{
  const other={...source,id:"other",board:"other"};
  const service=createFeedService({sources:[source,other],fetchImpl:async url=>url.includes("/other?")?new Response("Blocked",{status:403}):response({jobs:[posting()]})});
  const data=await service.get();assert.equal(data.status,"partial");assert.equal(data.jobs.length,1);assert.equal(data.sources[1].status,"unavailable");
});
test("refresh preserves explicit workflow and retains a missing tracked role",()=>{
  const original=mergeFeed([normalized()]);
  Object.assign(original[0],{stage:"Applied",favorite:false,notes:"",nextAction:"Keep exact action",appliedAt:"2026-11-02"});
  const refreshed=mergeFeed([normalized({title:"Changed source title"})],original,[{id:source.id,status:"ok"}]);
  assert.equal(refreshed[0].stage,"Applied");assert.equal(refreshed[0].favorite,false);assert.equal(refreshed[0].notes,"");assert.equal(refreshed[0].nextAction,"Keep exact action");
  const retained=mergeFeed([],refreshed,[{id:source.id,status:"ok"}]);
  assert.equal(retained.length,1);assert.equal(retained[0].retained,true);assert.equal(retained[0].availability,"not_in_latest_feed");
});
test("default filters include unknown salary; numeric floors and caps do not",()=>{
  const jobs=mergeFeed([normalized()]);
  assert.equal(selectJobs(jobs).length,1);assert.equal(selectJobs(jobs,{payFloor:"70000"}).length,0);
  assert.equal(selectJobs(jobs,{payFloor:"unknown"}).length,1);assert.equal(selectJobs(jobs,{travelCap:"0"}).length,0);
  assert.equal(selectJobs(jobs,{interviewCap:"2"}).length,0);assert.equal(selectJobs(jobs,{interviewCap:"unknown"}).length,1);
});
test("all real-feed filters compose, and date filters do not use crawl time",()=>{
  const job=normalized({descriptionPlain:"No business travel required. A 2-stage interview process.",compensation:{summaryComponents:[{compensationType:"Salary",interval:"1 YEAR",currencyCode:"USD",minValue:90000,maxValue:110000}]}});
  const jobs=mergeFeed([job]);
  assert.equal(selectJobs(jobs,{career:"Engineering",workplace:"Remote",payFloor:"70000",level:"Senior",employment:"Full-time",industry:"Test sector",region:"US",employer:"Test employer",travelCap:"0",interviewCap:"2",stage:"Not tracked",age:"7"},Date.parse(checked)).length,1);
  job.postedAt=null;assert.equal(selectJobs(mergeFeed([job]),{age:"7"},Date.parse(checked)).length,0);
  assert.equal(filterFields(jobs).length,13);
});
test("real-job CSV includes source provenance and protects user text",()=>{
  const jobs=mergeFeed([normalized()]);jobs[0].notes=' \t=SUM("quoted")\nSecond line';
  const csv=jobsCsv(jobs);assert.ok(csv.startsWith("\ufeff"));assert.match(csv,/posting_url/);assert.match(csv,/feed_checked_at/);
  assert.ok(csv.includes("https://jobs.ashbyhq.com/"));assert.ok(csv.includes("\"' \t=SUM("));assert.ok(!csv.includes("Fictional sample"));
});
test("the public endpoint rejects all writes without calling a feed",async()=>{
  const headers={},res={setHeader:(k,v)=>{headers[k]=v;},end:value=>{res.body=value;}};
  await handler({method:"POST"},res);assert.equal(res.statusCode,405);assert.equal(headers.Allow,"GET");assert.equal(headers["Access-Control-Allow-Origin"],"*");
});
test("query variants cannot trigger public upstream refreshes",async()=>{
  const headers={},res={setHeader:(k,v)=>{headers[k]=v;},end:value=>{res.body=value;}};
  await handler({method:"GET",url:"/api/jobs?random=1"},res);assert.equal(res.statusCode,400);assert.match(res.body,/does not accept query parameters/);
});
test("an all-failed refresh with stale real rows is not cached as a fresh success",async()=>{
  const headers={},res={setHeader:(k,v)=>{headers[k]=v;},end:value=>{res.body=value;}};
  const feed={get:async()=>({jobs:[normalized()],sources:[{status:"stale"}],status:"unavailable"})};
  await createJobsHandler(feed)({method:"GET",url:"/api/jobs"},res);
  assert.equal(res.statusCode,200);assert.equal(headers["Cache-Control"],"no-store");
  assert.equal(JSON.parse(res.body).jobs.length,1);
});
test("runtime assets contain no fixture import or hard-coded sample jobs",()=>{
  for(const name of ["app.js","model.js","index.html"]){
    const text=readFileSync(new URL(`../public-demo/${name}`,import.meta.url),"utf8");
    assert.ok(!/SAMPLE_JOBS|Aster Example|Birch Example|fictional roles only/i.test(text)&&!text.includes("fixtures/"),name);
  }
});
