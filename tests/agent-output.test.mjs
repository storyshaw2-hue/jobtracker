import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateAgentOutput} from "../scripts/validate-agent-output.mjs";
import {validateSnapshot,initialWorkspace,makeRequest,PLATFORM_CONTEXT} from "../src/domain.mjs";

const fixture=JSON.parse(readFileSync(new URL("../fixtures/demo.snapshot.json",import.meta.url),"utf8"));
const fresh=()=>{
  const snapshot=structuredClone(fixture);snapshot.generator="Perplexity";snapshot.run_status="partial";
  snapshot.run_started_at="2026-11-06T11:59:00.000Z";
  snapshot.profile.minimumScore=0;snapshot.profile.salaryFloor=0;
  snapshot.leads=snapshot.leads.slice(0,1);snapshot.counts.All=1;
  const job=snapshot.leads[0];
  job.company="Validator fixture";job.source="Untrusted input under test";job.url="https://jobs.ashbyhq.com/test-board/role-1";
  job.verification_status="active";job.verified_at="2026-11-06T12:00:00.000Z";
  job.score_components=Object.entries(snapshot.profile.weights).map(([component,points_possible])=>({component,points_possible,points_awarded:0,evidence:"Synthetic validator test only."}));
  job.checklist=[{requirement:"Synthetic test",outcome:"not evidenced"}];
  snapshot.sources.ledger=snapshot.profile.sources.map(source=>({source,attempted_at:"2026-11-06T12:00:00Z",outcome:"failed"}));
  return snapshot;
};
test("new private workspaces start with zero jobs, not a fictional fallback",()=>{
  const empty=JSON.parse(readFileSync(new URL("../fixtures/empty.snapshot.json",import.meta.url),"utf8"));
  validateSnapshot(empty);assert.equal(empty.leads.length+empty.hidden.length+empty.archived.length,0);assert.equal(empty.profile.resumes.length,0);
  assert.ok(readFileSync(new URL("../src/server.mjs",import.meta.url),"utf8").includes('resolve(root, "fixtures/empty.snapshot.json")'));
});
test("agent output checks are stricter than legacy snapshot compatibility",()=>{
  assert.throws(()=>validateAgentOutput(structuredClone(fixture)),/demonstration generator/);
  const snapshot=fresh();assert.equal(validateAgentOutput(snapshot).valid,true);
  snapshot.leads[0].score_components.pop();assert.throws(()=>validateAgentOutput(snapshot),/Eight unique/);
});
test("unknown or stale availability cannot become an active current lead",()=>{
  const snapshot=fresh();snapshot.leads[0].verification_status="unknown";assert.throws(()=>validateAgentOutput(snapshot),/active timestamped/);
  snapshot.leads[0].verification_status="active";snapshot.leads[0].verified_at="2026-11-05T12:00:00Z";assert.throws(()=>validateAgentOutput(snapshot),/outside the current run/);
});
test("renaming a demonstration generator is not real evidence",()=>{
  const snapshot=fresh();snapshot.leads[0].company="Sample Employer (fictional)";
  assert.throws(()=>validateAgentOutput(snapshot),/demonstration markers/);
});
test("source failures are explicit and prevent a complete run",()=>{
  const snapshot=fresh();snapshot.sources.ledger.pop();assert.throws(()=>validateAgentOutput(snapshot),/source is missing/);
  snapshot.sources.ledger=snapshot.profile.sources.map(source=>({source,attempted_at:"2026-11-06T12:00:00Z",outcome:"blocked"}));
  snapshot.run_status="complete";assert.throws(()=>validateAgentOutput(snapshot),/cannot be called complete/);
});
test("score caps and totals must reconcile even on partial runs",()=>{
  const snapshot=fresh(),job=snapshot.leads[0];job.score_cap=30;assert.throws(()=>validateAgentOutput(snapshot),/score cap explanation/);
  job.cap_reason="Synthetic cap for this unit test";job.score=20;assert.throws(()=>validateAgentOutput(snapshot),/does not reconcile/);
});
test("unknown values and explicit date blanks have truthful schema representations",()=>{
  const snapshot=fresh(),job=snapshot.leads[0];
  job.pay_min=null;job.date_posted=null;snapshot.hidden[0].date_posted=null;
  job.workflow={notes:"",favorite:false,appliedAt:"",nextActionDate:""};
  assert.equal(validateAgentOutput(snapshot).valid,true);
  snapshot.profile.salaryFloor=70000;assert.throws(()=>validateAgentOutput(snapshot),/annual USD floor/);
});
test("request comparison preserves exported blanks and rejects generated workflow overwrites",()=>{
  const snapshot=fresh();snapshot.profile.projectPlatform="Perplexity";snapshot.profile.experienceContext=PLATFORM_CONTEXT;
  const request=makeRequest(initialWorkspace(structuredClone(snapshot)),"Test-only request contract.");
  const job=snapshot.leads[0];request.priorWorkflow=[{jobId:job.job_id,status:"Interested",notes:"",favorite:false,appliedAt:""}];
  job.status="Interested";job.workflow={status:"Interested",notes:"",favorite:false,appliedAt:""};
  assert.equal(validateAgentOutput(snapshot,{request}).requestCompared,true);
  job.workflow.notes="Generated text must not replace an explicit blank.";
  assert.throws(()=>validateAgentOutput(snapshot,{request}),/Workflow notes changed/);
});
