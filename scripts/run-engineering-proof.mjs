const base=process.env.BASE_URL||"http://localhost:8000";
const task=process.env.PROOF_TASK||"Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";
const response=await fetch(base+"/v1/agent/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task,task_type:"coding",max_cost_usd:.05,max_tokens:512,max_iterations:3,max_wall_time_ms:120000,max_failures:2})});
const body=await response.json();
if(!response.ok) throw new Error("Agent run failed with HTTP "+response.status);
const trajectory=Array.isArray(body.trajectory)?body.trajectory:[], verification=body.verification||{};
const ok=verification.passed===true && Number(body.iteration??0)<=3 && Boolean(body.decision_id||body.run_id) && trajectory.length>0;
if(!ok){console.error(JSON.stringify({provenance:"UNVERIFIED_PROOF_RUN",status:body.status,verification_passed:verification.passed,iterations:body.iteration,trajectory_events:trajectory.length},null,2));process.exit(1);}
console.log(JSON.stringify({provenance:"MEASURED_ENGINEERING_PROOF_RUN",run_id:body.run_id,decision_id:body.decision_id,status:body.status,verification_passed:true,iterations:body.iteration,trajectory_events:trajectory.length,cost_usd:body.cost_usd,latency_ms:body.latency_ms},null,2));
