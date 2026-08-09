// OIA heuristic classifier — reads a repo WITHOUT executing it and produces a
// first-pass OIA matrix entry (layer vector + spans + evidence tier "auto").
// Ports the client-side LSIG/SSIG signal maps from docs/oia-matrix.html so the
// server-side auto-classification matches the page's "Rescan" button.
// Honest by construction: evidence tier is "auto" (structural signals, not
// comprehension), never "code ✓". Usage: node scripts/classify-oia.mjs owner/name [issueNumber] [YYYY-MM-DD]

const LSIG=[
 [/\bgpu\b/,/cuda/,/\btpu\b/,/neuromorphic/,/photonic/,/semiconductor/,/cooling/,/\benergy\b/],
 [/\.wasm/,/\.wat\b/,/\bwasi\b/,/onnx/,/\bmlir\b/,/triton/,/\brocm\b/],
 [/serverless/,/\bedge\b/,/kubernetes/,/\bk8s\b/,/terraform/,/dockerfile/,/wrangler/,/cloudflare/,/\blambda\b/,/self-host/,/sovereign/],
 [/vector/,/embedding/,/\bhnsw\b/,/\bivf\b/,/sqlite/,/postgres/,/neo4j/,/\.sql\b/,/lineage/,/chroma/,/pinecone/,/qdrant/,/\bann\b/],
 [/\btrain/,/fine-?tune/,/\blora\b/,/\brlhf\b/,/\bdpo\b/,/rlaif/,/\bevals?\b/,/checkpoint/,/dataset/],
 [/inference/,/\bserve/,/rout(er|ing)/,/retriev/,/rerank/,/\bvllm\b/],
 [/\brag\b/,/retrieval-augment/,/knowledge/,/langchain/,/llamaindex/,/haystack/,/knowledge-?graph/,/\bcontext\b/,/skills?\//],
 [/\bmcp\b/,/\.mcp/,/\bagents?\b/,/workflow/,/orchestrat/,/langgraph/,/crewai/,/autogen/,/\bswarm\b/,/tool-?call/],
 [/\bmemory\b/,/witness/,/provenance/,/continuity/,/attestation/,/\.lean\b/,/lakefile/,/audit-?trail/],
 [/index\.html/,/\.tsx\b/,/\.jsx\b/,/\bvite\b/,/\breact\b/,/\bnext\b/,/frontend/,/\bui\//,/\bpublic\//],
];
const SSIG={
 security:[/security/,/\bcvss\b/,/threat/,/vuln/,/owasp/,/firewall/,/sandbox/],
 sovereignty:[/local-first/,/self-host/,/\bedge\b/,/serverless/,/sovereign/,/offline/],
 auditability:[/\baudit/,/adrs?\//,/\badr-/,/constitution/,/governance/,/\btrace/],
 provenance:[/provenance/,/witness/,/sign(ed|ing)/,/attest/,/cite|citation/,/lineage/],
 identity:[/\bidentity\b/,/oauth/,/\bauth\b/,/\blogin\b/,/\bsso\b/],
 energy:[/\benergy\b/,/carbon/,/entrainment/,/\bpower\b/],
};
const BADGE={security:"sec",sovereignty:"sov",auditability:"aud",provenance:"prov",identity:"idn",energy:"ene"};
const LAYER_NAMES=["Physical Compute","Silicon Abstraction","Sovereign Infrastructure","Agent Data Substrate","Model Training & Adaptation","Inference & Retrieval","Context & Knowledge","Orchestration & Workflow","Continuity Fabric","Human & Browser Interface"];
const cnt=(rx,c)=>rx.reduce((n,r)=>n+(r.test(c)?1:0),0);
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
 const corpus=paths.slice(0,6000).join(' ')+' '+readme.slice(0,40000)+' '+((meta.topics||[]).join(' '))+' '+((meta.language||'').toLowerCase());

 const layers=LSIG.map(rx=>{const x=cnt(rx,corpus);return x>=3?2:x>=1?1:0;});
 const spans=Object.keys(SSIG).filter(k=>cnt(SSIG[k],corpus)>=1).map(k=>({label:k,badge:BADGE[k]}));
 const cog=layers.map((v,i)=>v===2?'L'+i:null).filter(Boolean);
 const pres=layers.map((v,i)=>v===1?'L'+i:null).filter(Boolean);
 const notes={}; layers.forEach((v,i)=>{if(v===2)notes[i]=`signal-detected centre of gravity (${LAYER_NAMES[i]})`;});

 const gate={issues:!!meta.has_issues,docs:paths.some(x=>/^docs?\//.test(x))||readme.length>800,ADRs:paths.some(x=>/adrs?\/|adr-\d/.test(x)),PRD:paths.some(x=>/prd/.test(x)),infographic:paths.some(x=>/infographic|\.svg$/.test(x))};
 const gateStr=Object.entries(gate).map(([k,v])=>`${k} ${v?'✓':'✗'}`).join(', ');

 return {
  name,
  desc:clean(meta.description||name,120),
  layers,
  spans,
  notes,
  narrative:`Auto-classified from a submission. Heuristic file-tree scan of ${paths.length} files${t.json.truncated?' (tree truncated)':''}; language ${meta.language||'n/a'}, pushed ${(meta.pushed_at||'').slice(0,10)}. Centre of gravity ${cog.join(', ')||'none detected'}; presence ${pres.join(', ')||'none'}. This is a structural signal pass, NOT a comprehension read, and awaits committee review before promotion.`,
  category:'app',
  evidence:{t:'auto',n:`Heuristic file-tree scan of ${paths.length} files on ${submitted||'submission'}: structural signals (real files, not just names), not comprehension. Qualification gate: ${gateStr}. Promote to code ✓ with a reader-agent audit and committee vote.`},
  gaps:['Committee: verify these auto-detected placements against the actual source (auto → code ✓).','Surface issue tracker + documentation + PRD/ADRs in the repo to meet the qualification gate.','Name the OIA layers/spans the project targets in its README.'],
  status:'pending',
  submitted:submitted||null,
  issue:issue?Number(issue):null,
 };
}

// CLI
if(import.meta.url===`file://${process.argv[1]}`){
 const [,,name,issue,submitted]=process.argv;
 if(!name){console.error('usage: node scripts/classify-oia.mjs owner/name [issue] [YYYY-MM-DD]');process.exit(2);}
 classify(name,issue,submitted).then(e=>{console.log(JSON.stringify(e,null,2));}).catch(e=>{console.error(String(e));process.exit(1);});
}
