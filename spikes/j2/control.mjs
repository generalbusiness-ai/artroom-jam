import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Focused distinguishing controls in a scratch copy; the checkout is unchanged.
const root = fileURLToPath(new URL('.', import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'jam-j2-control-'));
fs.mkdirSync(path.join(scratch, 'j0', 'src'), { recursive: true });
fs.copyFileSync(path.resolve(root, '../j0/src/transcribe.js'), path.join(scratch, 'j0', 'src', 'transcribe.js'));
fs.cpSync(root, path.join(scratch, 'j2'), { recursive: true, filter: (name) => !name.startsWith(path.join(root, 'work')) });
const source = path.join(scratch, 'j2', 'schedule.mjs');
const original = fs.readFileSync(source, 'utf8');
console.log(`Scratch evidence retained at ${scratch}`);
const changes = [
  ['round down instead of up', 'const steps = (n + d - 1n) / d;', 'const steps = n / d;'],
  ['omit the previous-entry hold', 'const effectBar = Math.max(previousBar, earliest);', 'const effectBar = earliest;'],
];
for (const [name, before, after] of changes) {
  if (original.split(before).length !== 2) throw new Error(`control is not one exact change: ${name}`);
  fs.writeFileSync(source, original.replace(before, after));
  const result = spawnSync(process.execPath, ['--test', path.join(scratch, 'j2', 'test', 'harness.test.mjs')], { encoding: 'utf8' });
  const output = result.stdout + result.stderr;
  fs.writeFileSync(path.join(scratch, `${name.replaceAll(' ', '-')}.log`), output);
  if (result.status === 0 || !output.includes('ERR_ASSERTION') || !output.includes('scripted listeners change theme together')) throw new Error(`control did not distinguish by the named assertion: ${name}\n${output}`);
  console.log(`Distinguishes by assertion: ${name}`);
}
fs.writeFileSync(source, original);
