// Inlines src/transcribe.js into the harness template, giving one self-contained harness/index.html.
const fs = require('fs'), path = require('path');
const d = path.resolve(__dirname, '..');
const t = fs.readFileSync(path.join(__dirname, 'harness.template.html'), 'utf8').replace('/*TRANSCRIBE_JS*/', () => fs.readFileSync(path.join(__dirname, 'transcribe.js'), 'utf8'));
fs.mkdirSync(path.join(d, 'harness'), { recursive: true });
fs.writeFileSync(path.join(d, 'harness/index.html'), t);
console.log('harness/index.html', t.length, 'bytes');
