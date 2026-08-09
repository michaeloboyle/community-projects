// Runs inside pages.yml on `issues` events. Two actions, driven by label:
//   status:pending-review  -> auto-classify the submitted repo into pending[] + post the badge snippet
//   status:approved        -> promote the repo pending[] -> curated[]
// Modifies docs/ in the working tree; pages.yml commits + deploys after this step.
import { execFileSync } from 'node:child_process';

const labels=(process.env.ISSUE_LABELS||'').split(',').map(s=>s.trim()).filter(Boolean);
const body=process.env.ISSUE_BODY||'';
const issue=process.env.ISSUE_NUMBER||'';
const date=(process.env.EVENT_DATE||'').slice(0,10);
const token=process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY||'agenticsorg/community-projects';

function extractRepo(b){
 const field=b.match(/###\s*Repository URL\s*\n+\s*(\S+)/i);
 const raw=field?field[1]:b;
 const g=raw.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git|[\/#?]|$)/i);
 if(g) return g[1];
 return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.trim())?raw.trim():null;
}
async function comment(txt){
 if(!token||!issue) return;
 await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`,{
  method:'POST',
  headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'oia-intake','content-type':'application/json'},
  body:JSON.stringify({body:txt})
 }).catch(e=>console.log('comment failed',String(e)));
}
const name=extractRepo(body);

if(labels.includes('status:approved')){
 if(!name){console.log('promote: no repo url in body');process.exit(0);}
 const out=execFileSync('node',['scripts/promote-pending.mjs',name],{encoding:'utf8'});
 console.log(out);
 if(out.includes('PROMOTED=')){
  const s='oia-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  await comment(`✅ **${name}** promoted to the curated OIA Application Matrix: https://agenticsorg.github.io/community-projects/oia-matrix.html#${s}`);
 }
 process.exit(0);
}

if(labels.includes('status:pending-review')){
 if(!name){console.log('classify: no repo url in body');process.exit(0);}
 let out;
 try{ out=execFileSync('node',['scripts/add-pending.mjs',name,String(issue),date],{encoding:'utf8'}); }
 catch(e){ console.log('classify failed',String(e)); await comment(`⚠️ Could not auto-classify \`${name}\` for the OIA matrix (repo not found, private, or invalid URL). A committee member can retry after checking the Repository URL.`); process.exit(0); }
 console.log(out);
 if(out.includes('ALREADY_CURATED')){console.log('already curated, skip');process.exit(0);}
 const embed=(out.match(/EMBED=(.+)/)||[,''])[1];
 const row=(out.match(/ROW=(.+)/)||[,''])[1];
 await comment([
  '### Added to the OIA Application Matrix (pending review)','',
  `\`${name}\` has been auto-classified into the **pending review** band. Evidence tier is \`auto ⟳\` — heuristic structural signals, not a code audit — and awaits committee review.`,'',
  `**Your row:** ${row}`,'',
  '**Add this badge to your README** (it links back to your matrix row):','',
  '```markdown',embed,'```','',
  'On committee approval (label `status:approved`), the row moves into the curated matrix.'
 ].join('\n'));
 process.exit(0);
}
console.log('no actionable label; nothing to do');
