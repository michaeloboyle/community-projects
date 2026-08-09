// One-time migration: pull the hardcoded apps[]/EVID/GAPS out of oia-matrix.html
// into docs/data/oia-matrix.json ({schema_version, layers, curated[], pending[]}).
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('docs/oia-matrix.html', 'utf8');
const grab = (name, open, close) => {
  const i = html.indexOf(`const ${name}=${open}`);
  if (i < 0) throw new Error(`missing ${name}`);
  let d = 0, start = i + `const ${name}=`.length, j = start;
  for (; j < html.length; j++) {
    if (html[j] === open) d++;
    else if (html[j] === close) { d--; if (d === 0) { j++; break; } }
  }
  return html.slice(start, j);
};
const layersSrc = grab('layers', '[', ']');
const appsSrc = grab('apps', '[', ']');
const evidSrc = grab('EVID', '{', '}');
const gapsSrc = grab('GAPS', '{', '}');
// eslint-disable-next-line no-eval
const layers = eval("("+layersSrc+")"), apps = eval("("+appsSrc+")"), EVID = eval("("+evidSrc+")"), GAPS = eval("("+gapsSrc+")");

const curated = apps.map(a => {
  const [name, desc, lyr, spans, notes, narrative, category] = a;
  return {
    name, desc,
    layers: lyr,                      // [10] of 0/1/2
    spans: spans.map(s => ({ label: s[0], badge: s[1] })),
    notes: notes || {},               // {layerIdx: "why"}
    narrative,
    category,                          // app | infra
    evidence: EVID[name] || { t: 'desc', n: 'Classified from the repo description/README only. Not yet verified against code.' },
    gaps: GAPS[name] || ['Meet the qualification gate and verify placements in code.'],
    status: 'curated'
  };
});

const out = {
  schema_version: 1,
  generated_note: 'Curated entries are committee-reviewed. Pending entries are auto-classified from a submission (desc tier) and awaiting committee promotion.',
  layers,                             // [["L0","Physical Compute"],...]
  curated,
  pending: []
};
writeFileSync('docs/data/oia-matrix.json', JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${curated.length} curated entries; layers=${layers.length}`);
console.log('names:', curated.map(c => c.name).join(', '));
