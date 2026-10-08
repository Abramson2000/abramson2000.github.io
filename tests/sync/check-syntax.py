from pathlib import Path
import re, subprocess, hashlib
root=Path(__file__).resolve().parents[2]
for n,js in enumerate(re.findall(r'<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>',(root/'tingli/index.html').read_text(),re.I),1):
    r=subprocess.run(['node','--check'],input=js,text=True,capture_output=True)
    if r.returncode: raise SystemExit(f'inline script {n}: {r.stderr}')
for name in ['tingli/sw.js','tingli/sync-core.js','tingli/word-sync.js','cidian/word-sync.js','cidian/app.js','cidian/sw.js','cidian/sync-core.js','backend/tingli-worker/worker.js','tingli/sync-check.js','tingli/sync-transport.5.67.0.js','cidian/sync-transport.2.16.0.js']:
    subprocess.run(['node','--check',str(root/name)],check=True)
shared=[hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['tingli/sync-core.js','cidian/sync-core.js','backend/tingli-worker/sync-core.js']]
assert len(set(shared))==1,'client/server protocol mismatch'
assert "APP_VER = '5.67.7'" in (root/'tingli/index.html').read_text()
assert 'tingli-cache-v5677-full' in (root/'tingli/sw.js').read_text()
assert "VERSION='2.16.0'" in (root/'cidian/app.js').read_text()
assert "const V = '2.16.0'" in (root/'cidian/sw.js').read_text()
print('All script syntax, protocol copies and release versions OK')

for a,b in [('cidian/app.js','cidian/app.2.16.0.js'),('cidian/sw.js','cidian/sw.2.16.0.js'),('cidian/word-sync.js','cidian/word-sync.2.16.0.js'),('cidian/word-sync.js','tingli/word-sync.js'),('tingli/word-sync.js','tingli/word-sync.5.64.0.js')]:
    assert (root/a).read_bytes()==(root/b).read_bytes(),f'{a} differs from {b}'

assert (root/"tingli/sync-transport.5.67.0.js").read_bytes()==(root/"cidian/sync-transport.2.16.0.js").read_bytes()
