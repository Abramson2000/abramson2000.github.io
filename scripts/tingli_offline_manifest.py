"""Print an offline manifest, or validate the committed one with --check.

Stage changed media first. Uses index object IDs, not a full download of media.
Unchanged file sizes are reused from earlier manifests; only changed media need
to be available locally. Output goes to stdout, never changes source files.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = (root / 'tingli/index.html').read_text()
worker = (root / 'tingli/sw.js').read_text()
version = re.search(r"const VERSION = '([^']+)'", worker)[1]
assert re.search(r"const APP_VER = '([^']+)'", html)[1] == version
path = root / 'tingli' / re.search(r"const MANIFEST = './([^']+)'", worker)[1]
shell = json.loads(re.search(r'const CORE_ASSETS = (\[[\s\S]*?\]);', worker)[1])
previous = {}
for old in sorted((root / 'tingli').glob('offline-manifest.*.json')):
    for item in json.loads(old.read_text()).get('media', []):
        previous[(item['url'], item['revision'])] = item['bytes']
entries = {}
indexed = subprocess.check_output(['git', 'ls-files', '--stage', '--', 'tingli/audio', 'tingli/img'], cwd=root, text=True)
for line in indexed.splitlines():
    meta, filename = line.split('\t')
    mode, sha, stage = meta.split()
    assert stage == '0', 'Resolve media merge conflicts first'
    entries[filename] = sha
audio = sorted(set(re.findall(r'"audio"\s*:\s*"([^\"]+)"', html)))
images = sorted(set(re.findall(r'"image"\s*:\s*"([^\"]+)"', html)))
media = []
for filename in ['audio/' + name for name in audio] + images:
    sha = entries['tingli/' + filename]
    url = './' + filename
    size = previous.get((url, sha))
    if size is None:
        local = root / 'tingli' / filename
        size = local.stat().st_size if local.exists() else int(subprocess.check_output(['git', 'cat-file', '-s', sha], cwd=root))
    media.append({'url': url, 'revision': sha, 'bytes': size})
result = {'version': version, 'shell': shell, 'media': media}
if '--check' in sys.argv:
    assert json.loads(path.read_text()) == result, 'Offline manifest must be regenerated for changed materials'
    print(f'Offline manifest OK: {len(shell)} shell files, {len(media)} media files')
else:
    print(json.dumps(result, ensure_ascii=False, indent=2))
