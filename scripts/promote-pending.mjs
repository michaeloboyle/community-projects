// Promote a pending OIA entry to curated (committee approval). Usage:
//   node scripts/promote-pending.mjs owner/name
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [,,name]=process.argv;
if(!name){console.error('usage: node scripts/promote-pending.mjs owner/name');process.exit(2);}
const file='docs/data/oia-matrix.json';
const data=JSON.parse(readFileSync(file,'utf8'));
const i=(data.pending||[]).findIndex(e=>e.name===name);
if(i<0){console.log('NOT_PENDING');process.exit(0);}
const [entry]=data.pending.splice(i,1);
entry.status='curated';
if(entry.evidence && entry.evidence.t==='auto'){
 entry.evidence.t='desc';
 entry.evidence.n='Committee-promoted from auto-classification. Placement reviewed by the committee but not yet audited against source; promote to code ✓ with a reader-agent audit. '+(entry.evidence.n||'');
}
data.curated=data.curated||[];
data.curated.push(entry);
writeFileSync(file,JSON.stringify(data,null,2)+'\n');
execFileSync('node',['scripts/build-badges.mjs'],{stdio:'inherit'});
console.log('PROMOTED='+name);
