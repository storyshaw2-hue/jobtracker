import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),output=resolve(root,"dist/public-demo");
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ["index.html","app.js","model.js","demo.css"]){
  await cp(resolve(root,"public-demo",file),resolve(output,file));
}
await cp(resolve(root,"public/styles.css"),resolve(output,"workspace.css"));
await cp(resolve(root,"public/fonts"),resolve(output,"fonts"),{recursive:true});
await cp(resolve(root,"public/licenses"),resolve(output,"licenses"),{recursive:true});
console.log("Built real-job frontend:",(await readdir(output)).join(", "));
console.log("No job fixtures, private seeds, account records or databases are bundled. The read-only feed is a separate API function.");
