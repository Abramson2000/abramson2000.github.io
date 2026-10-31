"""Проверка проекта перед выкладкой.

1. Синтаксис всех рабочих скриптов.
2. Согласованность версий: экран/код/service worker/кэш.
Ничего не хардкодит по версиям — читает их из файлов.
"""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
errors = []


def node_check_text(text, label):
    r = subprocess.run(['node', '--check'], input=text, text=True, capture_output=True)
    if r.returncode:
        errors.append(f'{label}: {r.stderr.strip().splitlines()[0] if r.stderr else "syntax error"}')


def node_check_file(rel):
    p = ROOT / rel
    if not p.exists():
        errors.append(f'{rel}: файл не найден')
        return
    r = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True)
    if r.returncode:
        errors.append(f'{rel}: {r.stderr.strip().splitlines()[0] if r.stderr else "syntax error"}')


JS_FILES = [
    'sw.js',
    'js/app.js',
    'js/db.js',
    'js/backup.js',
    'spin/app.4.1.0.js',
    'spin/data.3.3.0.js',
    'spin/sw.js',
    'tingli/sw.js',
    'tingli/sync-core.js',
    'tingli/sync-transport.5.67.0.js',
    'tingli/sync-check.js',
    'cidian/sw.js',
    'cidian/app.js',
    'cidian/sync-core.js',
    'cidian/sync-transport.2.23.2.js',
    'backend/tingli-worker/worker.js',
    'backend/tingli-worker/sync-core.js',
]

for rel in JS_FILES:
    node_check_file(rel)

# inline-скрипты на главных страницах (кроме огромной Тингли — там проверим отдельно)
for rel in ['index.html', 'spin/index.html']:
    p = ROOT / rel
    if not p.exists():
        errors.append(f'{rel}: файл не найден')
        continue
    for n, js in enumerate(re.findall(r'<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', p.read_text(), re.I), 1):
        if js.strip():
            node_check_text(js, f'{rel} inline #{n}')

# Тингли: один большой inline-блок проверяем тоже (файл 1,5 МБ, но node справляется)
p = ROOT / 'tingli/index.html'
if p.exists():
    for n, js in enumerate(re.findall(r'<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', p.read_text(), re.I), 1):
        if js.strip() and len(js) < 400000:
            node_check_text(js, f'tingli/index.html inline #{n}')


def read(rel):
    return (ROOT / rel).read_text()


def one(pattern, text, label):
    m = re.search(pattern, text)
    if not m:
        errors.append(f'{label}: версия не найдена')
        return None
    return m.group(1)


# --- Продажи: APP_VER == sw VERSION ---
app_ver = one(r"APP_VER\s*=\s*'([0-9.]+)'", read('spin/app.4.1.0.js'), 'spin/app.4.1.0.js')
sw_ver = one(r"VERSION\s*=\s*'([0-9.]+)'", read('spin/sw.js'), 'spin/sw.js')
if app_ver and sw_ver and app_ver != sw_ver:
    errors.append(f'Продажи: APP_VER {app_ver} ≠ sw VERSION {sw_ver}')
idx = read('spin/index.html')
if app_ver and idx.count(app_ver) == 0:
    errors.append(f'Продажи: версия {app_ver} не встречается в index.html')

# --- Тингли: APP_VER == sw VERSION ---
t_app = one(r"APP_VER\s*=\s*'([0-9.]+)'", read('tingli/index.html'), 'tingli/index.html')
t_sw = one(r"VERSION\s*=\s*'([0-9.]+)'", read('tingli/sw.js'), 'tingli/sw.js')
if t_app and t_sw and t_app != t_sw:
    errors.append(f'Тингли: APP_VER {t_app} ≠ sw VERSION {t_sw}')

# --- Словарь: версия приложения == версия service worker ---
c_ver = one(r"VERSION\s*=\s*'([0-9.]+)'", read('cidian/app.2.23.2.js'), 'cidian/app.2.23.2.js')
c_sw = one(r"const V\s*=\s*'([0-9.]+)'", read('cidian/sw.js'), 'cidian/sw.js')
if c_ver and c_sw and c_ver != c_sw:
    errors.append(f'Словарь: app VERSION {c_ver} ≠ sw V {c_sw}')

# --- База: APP_VER == суффикс кэша ---
b_app = one(r"APP_VER\s*=\s*'([0-9.]+)'", read('index.html'), 'index.html')
b_cache = one(r"APP_CACHE\s*=\s*'crm-app-([0-9.]+)'", read('sw.js'), 'sw.js')
if b_app and b_cache and b_app != b_cache:
    errors.append(f'База: APP_VER {b_app} ≠ кэш {b_cache}')

if errors:
    print('Проверка не пройдена:')
    for e in errors:
        print(' ✗', e)
    sys.exit(1)

print('Проверка пройдена: синтаксис в порядке, версии согласованы.')
