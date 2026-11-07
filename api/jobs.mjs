import {liveFeed} from "../src/live-feed.mjs";

export function createJobsHandler(feed=liveFeed){return async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Access-Control-Allow-Origin","*"); // Public read-only employer data.
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");res.statusCode=405;res.end(JSON.stringify({error:"Only GET is supported"}));return;
  }
  // One canonical cache key. Query variants never trigger upstream feed work.
  if(String(req.url??"").includes("?")||Object.keys(req.query??{}).length){
    res.statusCode=400;res.setHeader("Cache-Control","public, max-age=300");
    res.end(JSON.stringify({error:"This public endpoint does not accept query parameters. Use /api/jobs."}));return;
  }
  try{
    const data=await feed.get();
    const freshlyChecked=data.sources.some(s=>s.status==="ok");
    const usable=data.jobs.length>0||freshlyChecked;
    res.statusCode=usable?200:503;
    res.setHeader("Cache-Control",freshlyChecked?"public, s-maxage=300, stale-while-revalidate=120":"no-store");
    let payload=data,body=JSON.stringify(payload);
    while(Buffer.byteLength(body)>4*1024*1024&&payload.jobs.length){
      payload={...payload,jobs:payload.jobs.slice(0,-100),truncated:true};
      body=JSON.stringify(payload);
    }
    res.end(body);
  }catch{
    res.statusCode=503;res.setHeader("Cache-Control","no-store");
    res.end(JSON.stringify({error:"The employer feeds could not be checked. No replacement jobs were generated."}));
  }
};}

export default createJobsHandler();
