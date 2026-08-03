/**
 * "Build" for a single-file app: there is nothing to bundle, so this only assembles
 * the publishable directory. Kept as a script rather than a shell one-liner so the
 * local run, the test run, and the Pages deploy all produce identical output.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const SOURCE = 'merchant-agent-platform-1.html';
const OUT_DIR = 'dist';
const OUT_FILE = `${OUT_DIR}/index.html`;

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// index.html so the site root serves the console directly.
copyFileSync(SOURCE, OUT_FILE);

// Tells GitHub Pages to publish the directory as-is instead of running it through
// Jekyll, which would otherwise swallow any file whose name starts with "_".
writeFileSync(`${OUT_DIR}/.nojekyll`, '');

const raw = statSync(OUT_FILE).size;
const gzip = gzipSync(readFileSync(OUT_FILE), { level: 9 }).length;

console.log(`built ${OUT_FILE}`);
console.log(`  raw   ${kb(raw)}`);
console.log(`  gzip  ${kb(gzip)}  (what a visitor actually downloads)`);
