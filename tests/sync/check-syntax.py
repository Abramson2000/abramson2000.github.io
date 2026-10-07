from pathlib import Path
import re, subprocess, hashlib
root=Path(__file__).resolve().parents[2]
for n,js in enumerate(re.findall(r'<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>',(root/'tingli/index.html').read_text(),re.I),1):
    r=subprocess.run(['node','--check'],input=js,text=True,capture_output=True)
    if r.returncode: raise SystemExit(f'inline script {n}: {r.stderr}')
for name in ['tingli/sw.js','tingli/sync-core.js','cidian/app.js','cidian/sw.js','cidian/sync-core.js','backend/tingli-worker/worker.js']:
    subprocess.run(['node','--check',str(root/name)],check=True)
shared=[hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['tingli/sync-core.js','cidian/sync-core.js','backend/tingli-worker/sync-core.js']]
assert len(set(shared))==1,'client/server protocol mismatch'
assert "APP_VER = '5.61.0'" in (root/'tingli/index.html').read_text()
assert 'tingli-cache-v5610-full' in (root/'tingli/sw.js').read_text()
assert "VERSION='2.11.0'" in (root/'cidian/app.js').read_text()
assert "const V = '2.11.0'" in (root/'cidian/sw.js').read_text()
print('All script syntax, protocol copies and release versions OK')
