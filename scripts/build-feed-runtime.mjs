import {cp,mkdir,rm} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const output=resolve(root,"dist/public-feed-runtime");
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,"api"),{recursive:true});
await mkdir(resolve(output,"src"),{recursive:true});
await mkdir(resolve(output,"dist"),{recursive:true});
for(const file of ["api/jobs.mjs","src/live-feed.mjs","src/live-preview-server.mjs"]){
  await cp(resolve(root,file),resolve(output,file));
}
const assets=["index.html","app.js","model.js","demo.css","workspace.css",
  "fonts/Carlito-Regular.woff2","fonts/Carlito-Bold.woff2","licenses/Carlito-OFL.txt"];
for(const file of assets){
  await mkdir(dirname(resolve(output,"dist/public-demo",file)),{recursive:true});
  await cp(resolve(root,"dist/public-demo",file),resolve(output,"dist/public-demo",file));
}
console.log("Built isolated public-feed runtime: three Node-only modules plus public static assets.");
console.log("No private app, seed, schema, database, credentials, dependencies or user records were copied.");
