// Renders one line per matrix row from docs/data/qe-scans.json (written by
// .github/workflows/qe-release-scan.yml). Shared by the page and the tests.
// Coverage comes before findings on purpose: a scan that read 5 of 125 files
// says little either way, and the reader should see that first.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function qeAdvisoryText(rec) {
  const tool = 'agentic-qe (Dragan Spiridonov)';
  if (!rec) return `Advisory QE scan, ${tool}: not yet scanned.`;
  const at = esc(rec.kind === 'release' ? `release ${rec.ref}` : `${rec.ref} branch`);
  const when = esc(String(rec.scanned_at || '').slice(0, 10));
  if (rec.status === 'error') return `Advisory QE scan, ${tool}, ${at} (${when}): the scan did not complete.`;
  if (rec.status === 'not-analysed' || !rec.files_scanned) {
    return `Advisory QE scan, ${tool}, ${at} (${when}): not analysed; the scanner read 0 of ${Number(rec.files_requested) || 0} files (language or layout not supported yet).`;
  }
  const n = Number(rec.findings) || 0;
  const f = n === 1 ? '1 unverified finding' : `${n} unverified findings`;
  return `Advisory QE scan, ${tool}, ${at} (${when}): read ${Number(rec.files_scanned)} of ${Number(rec.files_requested) || '?'} files; ${f}. Advisory only, not a review.`;
}
