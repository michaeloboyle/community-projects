// Orchestration used by the on-submission workflow: classify a submitted repo and
// append it to docs/data/oia-matrix.json pending[] (dedup by name), then rebuild
// badges. Prints the README embed snippet on stdout for the workflow to post back.
// Usage: node scripts/add-pending.mjs owner/name [issue] [YYYY-MM-DD]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { classify } from './classify-oia.mjs';

const [,,name,issue,submitted]=process.argv;
if(!name){console.error('usage: node scripts/add-pending.mjs owner/name [issue] [YYYY-MM-DD]');process.exit(2);}
const file='docs/data/oia-matrix.json';
const data=JSON.parse(readFileSync(file,'utf8'));
data.pending=data.pending||[];

const inCurated=(data.curated||[]).some(e=>e.name===name);
const pIdx=data.pending.findIndex(e=>e.name===name);
if(inCurated){console.log('ALREADY_CURATED');process.exit(0);}

const entry=await classify(name,issue,submitted);
if(pIdx>=0) data.pending[pIdx]=entry; else data.pending.push(entry);
writeFileSync(file,JSON.stringify(data,null,2)+'\n');
execFileSync('node',['scripts/build-badges.mjs'],{stdio:'inherit'});

const bslug='oia-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
const base='https://agenticsorg.github.io/community-projects';
const embed=`[![OIA](${base}/badges/${name}.svg)](${base}/oia-matrix.html#${bslug})`;
console.log('EMBED='+embed);
console.log('ROW='+base+'/oia-matrix.html#'+bslug);
