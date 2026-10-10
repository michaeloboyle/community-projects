// Runs inside pages.yml on `issues` events. Two actions, driven by label:
//   status:pending-review  -> auto-classify the submitted repo into pending[] + post the badge snippet
//   status:approved        -> promote the repo pending[] -> curated[]
// Modifies docs/ in the working tree; pages.yml commits + deploys after this step.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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
// Markers that identify a comment this script has already posted. Kept as
// exported constants so the idempotency test pins the exact strings: changing a
// heading without changing its marker would silently re-enable duplicates.
export const PENDING_MARKER = '### Added to the OIA Application Matrix';
export const PROMOTED_MARKER = 'promoted to the curated OIA Application Matrix';

/**
 * True when `marker` already appears in one of this issue's comments.
 *
 * WHY. Every workflow in this repo can fire more than once for the same issue:
 * `opened` and `labeled` both trigger intake, a persist retry re-runs the whole
 * step, and a committee member re-applying a label to re-run the pipeline is a
 * supported remediation. On 2026-09-28 exactly that happened. All five open
 * submissions were label-cycled to backfill the notifications they never got
 * when the label race was live, and #51 and #53 each received a SECOND
 * "Added to the OIA Application Matrix" comment, because this script was the one
 * comment path without the guard its siblings got in #58.
 *
 * Pure and separately testable on purpose: the duplicate was not a networking
 * failure, it was a missing decision, and a missing decision should be covered
 * by a test rather than by care.
 */
export function alreadyPosted(comments, marker){
 return (comments||[]).some(c => typeof (c && c.body) === 'string' && c.body.includes(marker));
}

async function listComments(){
 if(!token||!issue) return [];
 try{
  const r = await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments?per_page=100`,{
   headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'oia-intake'}
  });
  if(!r.ok) return null;          // null means "could not tell", distinct from "none"
  const j = await r.json();
  return Array.isArray(j) ? j : null;
 }catch{ return null; }
}

/**
 * Post a comment unless an equivalent one is already there.
 *
 * `marker` is optional. Without it the comment is unconditional, which is
 * correct for a one-off failure notice. With it the comment is at-most-once.
 *
 * If the comment list cannot be read we do NOT post. A missed notification is
 * recoverable by re-applying the label; a duplicate sent to an outside
 * contributor is not. Fail closed, and say so in the log rather than silently.
 */
async function comment(txt, marker){
 if(!token||!issue) return;
 // Set on the persist-step retry path (pages.yml): the classification is being
 // regenerated against a main that moved under us, and the submitter has already
 // been told. A retry must not re-comment on the issue.
 if(process.env.OIA_SKIP_COMMENT==='1'){console.log('comment suppressed (retry pass)');return;}
 if(marker){
  const existing = await listComments();
  if(existing === null){
   console.log('comment skipped: could not read existing comments, failing closed to avoid a duplicate');
   return;
  }
  if(alreadyPosted(existing, marker)){
   console.log('comment skipped: already posted ('+marker.slice(0,40)+')');
   return;
  }
 }
 await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`,{
  method:'POST',
  headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'oia-intake','content-type':'application/json'},
  body:JSON.stringify({body:txt})
 }).catch(e=>console.log('comment failed',String(e)));
}
// Executed only when run directly. The module exports `alreadyPosted` and the
// markers so they can be tested, and importing it must not run intake: this file
// posts comments and mutates the matrix, so an accidental import would act on a
// live issue. Compare against a pathToFileURL-built href, not a concatenated
// string, so a checkout path containing a space still matches.
async function main(){
  const name=extractRepo(body);

  if(labels.includes('status:approved')){
   if(!name){console.log('promote: no repo url in body');process.exit(0);}
   const out=execFileSync('node',['scripts/promote-pending.mjs',name],{encoding:'utf8'});
   console.log(out);
   if(out.includes('PROMOTED=')){
    const s='oia-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
    await comment(`✅ **${name}** promoted to the curated OIA Application Matrix: https://agenticsorg.github.io/community-projects/oia-matrix.html#${s}`, PROMOTED_MARKER);
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
    '### Added to the OIA Application Matrix (listed, not yet reviewed)','',
    `\`${name}\` has been auto-classified and is now **listed** in the matrix, marked not yet reviewed. Evidence tier is \`auto ⟳\`: heuristic structural signals, not a code audit. Committee review is optional; it adds the reviewed mark.`,'',
    `**Your row:** ${row}`,'',
    '**Add this badge to your README** (it links back to your matrix row):','',
    '```markdown',embed,'```','',
    'If the committee reviews and approves it (label `status:approved`), the row moves into the curated, reviewed set.'
   ].join('\n'), PENDING_MARKER);
   process.exit(0);
  }
  console.log('no actionable label; nothing to do');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
