// Build only Jam-owned source plus genuinely installed public dependencies.
// ESBUILD_EXECUTABLE may name the reviewed pinned scratch tool; no install here.
import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const executable=process.env.ESBUILD_EXECUTABLE ?? 'esbuild';
if(execFileSync(executable,['--version'],{encoding:'utf8'}).trim()!=='0.28.1')throw new Error('Reviewed esbuild 0.28.1 required');
mkdirSync(dist,{recursive:true});
execFileSync(executable,['page/native-app.ts','--bundle','--format=esm','--platform=browser','--target=es2022','--outfile=dist/native-app.js'],{cwd:root,stdio:'inherit'});
copyFileSync(join(root,'page/native.html'),join(dist,'index.html'));

copyFileSync(join(root,'spikes/j0/src/transcribe.js'),join(dist,'transcribe.js'));
