import http from "node:http";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import handler from "../api/jobs.mjs";

const root=resolve("dist/public-demo");
const files=new Map([
  ["/","index.html"],["/index.html","index.html"],["/app.js","app.js"],["/model.js","model.js"],
  ["/demo.css","demo.css"],["/workspace.css","workspace.css"],
  ["/fonts/Carlito-Regular.woff2","fonts/Carlito-Regular.woff2"],["/fonts/Carlito-Bold.woff2","fonts/Carlito-Bold.woff2"],
  ["/licenses/Carlito-OFL.txt","licenses/Carlito-OFL.txt"]
]);
const mime={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",woff2:"font/woff2",txt:"text/plain; charset=utf-8"};
http.createServer(async(req,res)=>{
  let path;
  try{path=new URL(req.url,"http://localhost").pathname;}
  catch{res.statusCode=400;res.end("Invalid request");return;}
  if(path==="/api/jobs")return handler(req,res);
  if(req.method!=="GET"||!files.has(path)){res.statusCode=404;res.end("Not found");return;}
  try{
    const file=files.get(path),data=await readFile(resolve(root,file));
    res.setHeader("Content-Type",mime[file.split(".").pop()]??"application/octet-stream");
    res.setHeader("Cache-Control","no-cache");res.setHeader("X-Content-Type-Options","nosniff");res.end(data);
  }catch{res.statusCode=503;res.end("Build the job-tracker assets before starting this server.");}
}).listen(Number(process.env.PORT||5004),process.env.HOST||"0.0.0.0",()=>console.log(`Real job feed listening on ${process.env.PORT||5004}`));
