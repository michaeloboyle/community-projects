// Generate a self-hosted SVG badge per repo from docs/data/oia-matrix.json into
// docs/badges/<owner>/<repo>.svg. No external service (no shields.io). Each badge
// links (via the README embed the page hands out) back to the repo's matrix row.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const TIER_COLOR={code:'#37a35a',auto:'#3e9bff',desc:'#736e64',warn:'#e5484d'};
const TIER_LBL={code:'code✓',auto:'auto',desc:'desc',warn:'desc⚠'};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// rough monospace-ish width; DejaVu Sans ~6.2px/char at 11px
const w=s=>Math.ceil(String(s).length*6.4)+10;

function badge(entry){
 const tier=(entry.evidence&&entry.evidence.t)||'desc';
 const cog=entry.layers.map((v,i)=>v===2?'L'+i:null).filter(Boolean);
 const pres=entry.layers.map((v,i)=>v===1?'L'+i:null).filter(Boolean);
 const core=cog.length?cog.join('·'):(pres.length?pres.slice(0,3).join('·'):'L?');
 const label='OIA';
 const msg=`${core} · ${TIER_LBL[tier]||'desc'}`;
 const lw=w(label), mw=w(msg), H=20;
 const color=TIER_COLOR[tier]||'#736e64';
 const total=lw+mw;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(msg)}">
<title>${esc(label)}: ${esc(msg)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${total}" height="${H}" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${lw}" height="${H}" fill="#3d3a34"/>
<rect x="${lw}" width="${mw}" height="${H}" fill="${color}"/>
<rect width="${total}" height="${H}" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw/2}" y="14">${esc(label)}</text>
<text x="${lw+mw/2}" y="14">${esc(msg)}</text>
</g></svg>`;
}

const data=JSON.parse(readFileSync('docs/data/oia-matrix.json','utf8'));
const all=[...(data.curated||[]),...(data.pending||[])];
let n=0;
for(const e of all){
 const path=`docs/badges/${e.name}.svg`;
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,badge(e));
 n++;
}
console.log(`generated ${n} badges under docs/badges/`);
