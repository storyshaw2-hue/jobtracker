import test from "node:test";
import assert from "node:assert/strict";
import {freshJobs,selectJobs,sampleCsv,SAMPLE_JOBS} from "../public-demo/model.js";
test("public demo spans professions and clones only fictional data",()=>{
  const a=freshJobs(),b=freshJobs();assert.equal(a.length,6);assert.equal(new Set(a.map(j=>j.career)).size,6);
  a[0].notes="temporary";assert.equal(b[0].notes,"");assert.equal(SAMPLE_JOBS[0].notes,"");
  assert.ok(a.every(j=>j.id.startsWith("sample-")&&j.company.endsWith("Example")));
});
test("public demo filters career, workplace, salary, workflow and free text",()=>{
  const a=freshJobs();assert.equal(selectJobs(a,{career:"Design"}).length,1);
  assert.equal(selectJobs(a,{workplace:"Remote"}).length,3);assert.equal(selectJobs(a,{payFloor:110000}).length,1);
  assert.equal(selectJobs(a,{filter:"pipeline"}).length,2);assert.equal(selectJobs(a,{filter:"favorite"}).length,2);
  assert.equal(selectJobs(a,{career:"Design",workplace:"Remote"}).length,0);
  a[2].notes="needle-demo";assert.equal(selectJobs(a,{query:"needle-demo"})[0].id,a[2].id);
});
test("public demo sorts consistently without claiming a match score",()=>{
  const a=freshJobs();assert.equal(selectJobs(a,{sort:"pay"})[0].min,110000);
  assert.equal(selectJobs(a)[0].company,"Aster Example");assert.ok(a.every(j=>!("score" in j)&&!("chance" in j)));
});
test("public demo CSV quotes multiline content and escapes formulas",()=>{
  const a=freshJobs();a[0].notes=' \t=SUM(1,2)\n"quoted"';
  const csv=sampleCsv(a);assert.ok(csv.startsWith("\ufeff"));assert.ok(csv.includes('"\' \t=SUM(1,2)\n""quoted"""'));
  assert.ok(csv.includes("Fictional sample; not a live posting"));assert.ok(csv.includes("sample-accounting"));
});
