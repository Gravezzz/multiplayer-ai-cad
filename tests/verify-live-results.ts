import assert from 'node:assert/strict';
import fs from 'node:fs';
const get=async(room:string)=>await (await fetch(`http://127.0.0.1:3100/api/rooms/${room}`)).json();
const initial=await get('wearable-editable-2026');
const parallel=await get('parallel-check-54dfd428');
assert.ok(parallel.jobs.every((j:any)=>j.status==='complete'));
assert.ok(parallel.history.some((h:any)=>h.kind==='conflict'&&h.text.includes('STALE_REVISION')));
for(const p of initial.parts){const actual=parallel.parts.find((a:any)=>a.id===p.id);if(p.name==='Ref_module')assert.deepEqual(actual,{...p,operations:[{type:'translate',vector:[0,0,2]}]});else if(p.name==='Front_Right')assert.deepEqual(actual,{...p,operations:[{type:'translate',vector:[3,0,0]}]});else assert.deepEqual(actual,p);}
const band=await get('band-agent-check-65c24173e440');
assert.equal(band.parts.length,8);
for(const p of initial.parts){const actual=band.parts.find((a:any)=>a.id===p.id);if(p.name==='Band'){assert.equal(actual.source.assetId,p.source.assetId);assert.deepEqual(actual.operations.map((o:any)=>o.type),['rotate','clip','boolean','boolean']);}else assert.deepEqual(actual,p);}
const evidence={date:new Date().toISOString(),bandTest:{room:'band-agent-check-65c24173e440',unchangedOtherBodies:7,sourcePreserved:true,newBodies:0,jobs:band.jobs},parallelTest:{room:'parallel-check-54dfd428',bothEditsPreserved:true,unrelatedBodiesPreserved:6,conflict:parallel.history.filter((h:any)=>h.kind==='conflict'),jobs:parallel.jobs}};
fs.writeFileSync('docs/verified-live-runs.json',JSON.stringify(evidence,null,2));console.log('PASS: real band editing, seven unchanged bodies, natural live conflict and both concurrent edits preserved.');
