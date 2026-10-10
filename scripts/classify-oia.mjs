// OIA heuristic classifier — reads a repo WITHOUT executing it and produces a
// first-pass OIA matrix entry (layer vector + spans + evidence tier "auto").
// Signal maps and corpus construction come from docs/oia-signals.mjs, which the
// page's "Rescan" button imports too, so the two results cannot drift.
// Honest by construction: evidence tier is "auto" (structural signals, not
// comprehension), never "code ✓". Usage: node scripts/classify-oia.mjs owner/name [issueNumber] [YYYY-MM-DD]

import { pathToFileURL } from 'node:url';
import { LAYER_NAMES, SCAN_CAP, buildCorpus, classifySignals } from '../docs/oia-signals.mjs';

const NAME_RE=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;   // GitHub owner/repo charset
// Untrusted text (repo description) is later rendered via innerHTML on the page.
// Strip HTML-significant chars so a submitted repo can't inject markup/script.
const clean=(s,max=140)=>String(s||'').replace(/[<>&"'`]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

async function gh(path){
 const headers={'accept':'application/vnd.github+json','user-agent':'oia-classifier'};
 if(process.env.GITHUB_TOKEN) headers.authorization='Bearer '+process.env.GITHUB_TOKEN;
 const r=await fetch('https://api.github.com'+path,{headers});
 return {ok:r.ok,status:r.status,json:await r.json().catch(()=>({}))};
}

export async function classify(name,issue,submitted){
 if(!NAME_RE.test(name)) throw new Error('invalid repo name (expected owner/repo): '+name);
 const m=await gh('/repos/'+name);
 if(!m.ok) throw new Error(`repo fetch failed for ${name}: HTTP ${m.status} ${m.json.message||''}`);
 const meta=m.json;
 const br=meta.default_branch||'main';
 const t=await gh(`/repos/${name}/git/trees/${br}?recursive=1`);
 const paths=Array.isArray(t.json.tree)?t.json.tree.map(x=>x.path.toLowerCase()):[];
 let readme='';
 const rd=await gh('/repos/'+name+'/readme');
 if(rd.ok&&rd.json.content){try{readme=Buffer.from(rd.json.content,'base64').toString('utf8').toLowerCase();}catch{}}
 const corpus=buildCorpus({paths,readme,topics:meta.topics||[],language:meta.language||''});
 const {layers,spans}=classifySignals(corpus);
 const cog=layers.map((v,i)=>v===2?'L'+i:null).filter(Boolean);
 const pres=layers.map((v,i)=>v===1?'L'+i:null).filter(Boolean);
 const notes={}; layers.forEach((v,i)=>{if(v===2)notes[i]=`signal-detected centre of gravity (${LAYER_NAMES[i]})`;});

 const gate={issues:!!meta.has_issues,docs:paths.some(x=>/^docs?\//.test(x))||readme.length>800,ADRs:paths.some(x=>/adrs?\/|adr-\d/.test(x)),PRD:paths.some(x=>/prd/.test(x)),infographic:paths.some(x=>/infographic|\.svg$/.test(x))};
 const gateStr=Object.entries(gate).map(([k,v])=>`${k} ${v?'✓':'✗'}`).join(', ');

 // #64: scaffolding exclusion and scan-cap truncation are reported separately.
 // Summing them and calling the total "scaffolding" overstated the count by two
 // orders of magnitude on large repos and hid how much of the tree went unread.
 const denoisedTotal=corpus.kept+corpus.truncated;
 const scanScope=corpus.truncated?`${corpus.kept} of ${denoisedTotal}`:`${corpus.kept}`;
 const scanParts=[];
 if(corpus.dropped) scanParts.push(`${corpus.dropped} scaffolding path${corpus.dropped===1?'':'s'} excluded`);
 if(corpus.truncated) scanParts.push(`${corpus.truncated} beyond the ${SCAN_CAP}-file scan cap, not read`);
 if(t.json.truncated) scanParts.push('tree truncated by GitHub');
 const scanNote=scanParts.length?` (${scanParts.join('; ')})`:'';

 return {
  name,
  desc:clean(meta.description||name,120),
  layers,
  spans,
  notes,
  narrative:`Auto-classified from a submission. Heuristic file-tree scan of ${scanScope} project files${scanNote}; language ${meta.language||'n/a'}, pushed ${(meta.pushed_at||'').slice(0,10)}. Centre of gravity ${cog.join(', ')||'none detected'}; presence ${pres.join(', ')||'none'}. This is a structural signal pass, NOT a comprehension read, and committee review is optional.`,
  category:'app',
  evidence:{t:'auto',n:`Heuristic file-tree scan of ${scanScope} project files on ${submitted||'submission'}${scanNote}: structural signals (real files, not just names), not comprehension. Qualification gate: ${gateStr}. Promote to code ✓ with a reader-agent audit and committee vote.`},
  gaps:['Committee: verify these auto-detected placements against the actual source (auto → code ✓).','Surface issue tracker + documentation + PRD/ADRs in the repo to meet the qualification gate.','Name the OIA layers/spans the project targets in its README.'],
  status:'pending',
  submitted:submitted||null,
  issue:issue?Number(issue):null,
 };
}

// CLI
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const [,,name,issue,submitted]=process.argv;
 if(!name){console.error('usage: node scripts/classify-oia.mjs owner/name [issue] [YYYY-MM-DD]');process.exit(2);}
 classify(name,issue,submitted).then(e=>{console.log(JSON.stringify(e,null,2));}).catch(e=>{console.error(String(e));process.exit(1);});
}
