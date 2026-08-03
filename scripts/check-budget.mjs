/**
 * Size budget. The whole console is one file with the data inlined, so it grows every
 * time a page is added — this is the thing that stops it drifting from "loads instantly"
 * to "loads eventually" without anyone noticing.
 *
 * Budgets sit roughly 15% above the current size: enough room for real work, tight
 * enough that a large accidental addition (a base64 asset, a duplicated dataset)
 * fails the build instead of shipping.
 */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const TARGET = 'dist/index.html';

const BUDGET = {
  raw: 700 * 1024, // 700 KB on disk
  gzip: 220 * 1024, // 220 KB over the wire
};

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let raw;
try {
  raw = statSync(TARGET).size;
} catch {
  console.error(`✗ ${TARGET} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const gzip = gzipSync(readFileSync(TARGET), { level: 9 }).length;

const checks = [
  { name: 'raw', actual: raw, limit: BUDGET.raw },
  { name: 'gzip', actual: gzip, limit: BUDGET.gzip },
];

let failed = false;
for (const c of checks) {
  const pct = ((c.actual / c.limit) * 100).toFixed(1);
  const over = c.actual > c.limit;
  if (over) failed = true;
  console.log(
    `${over ? '✗' : '✓'} ${c.name.padEnd(5)} ${kb(c.actual).padStart(9)} / ${kb(c.limit).padStart(9)}  (${pct}% of budget)`,
  );
}

if (failed) {
  console.error(
    '\nSize budget exceeded. Either trim the page or raise the limit in scripts/check-budget.mjs\n' +
      'with a note in the commit message saying why the page needs to be bigger.',
  );
  process.exit(1);
}

console.log('\nWithin budget.');
