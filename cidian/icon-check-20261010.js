/* Read-only icon diagnostics, shown only with ?iconcheck=1. */
(function () {
  'use strict';
  if (new URL(location.href).searchParams.get('iconcheck') !== '1') return;
  async function check() {
    const report = {type: 'icon-check-20261010', url: location.href,
      userAgent: navigator.userAgent, standalone: navigator.standalone === true,
      controller: navigator.serviceWorker && navigator.serviceWorker.controller
        ? navigator.serviceWorker.controller.scriptURL : null, icons: [], errors: []};
    const panel = document.createElement('section');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#fbf7f0;color:#32261e;padding:24px;font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif';
    const content = document.createElement('div');
    content.style.cssText = 'max-width:640px;margin:auto';
    panel.appendChild(content);
    const heading = document.createElement('h1');
    heading.textContent = 'Проверка значков';
    content.appendChild(heading);
    const note = document.createElement('p');
    note.textContent = 'Проверяем, какие изображения загрузились на этом устройстве…';
    content.appendChild(note);
    const close = document.createElement('button');
    close.textContent = 'Вернуться в приложение';
    close.style.cssText = 'font:inherit;padding:10px 14px;margin:8px 12px 8px 0';
    close.onclick = function () { panel.remove(); };
    content.appendChild(close);
    const copy = document.createElement('button');
    copy.textContent = 'Скопировать проверку';
    copy.disabled = true;
    copy.style.cssText = close.style.cssText;
    content.appendChild(copy);
    document.body.appendChild(panel);
    const links = Array.from(document.head.querySelectorAll('link[rel]')).filter(function (link) {
      return /^(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon|manifest)$/.test(link.rel);
    });
    async function inspect(url, description, imageExpected) {
      const item = {description: description, url: url};
      report.icons.push(item);
      const row = document.createElement('div');
      row.style.cssText = 'border-top:1px solid #ddd;padding:16px 0;overflow-wrap:anywhere';
      const label = document.createElement('p');
      label.textContent = description;
      row.appendChild(label);
      content.appendChild(row);
      const abort = new AbortController();
      const timer = setTimeout(function () { abort.abort(); }, 12000);
      try {
        const response = await fetch(url, {cache: 'no-store', signal: abort.signal});
        item.status = response.status;
        item.finalURL = response.url;
        item.mime = response.headers.get('content-type');
        const blob = await response.blob();
        item.bytes = blob.size;
        if (!response.ok) throw new Error('HTTP ' + response.status);
        if (imageExpected) {
          // Decode the actual response from this browser; reject HTML/error pages even with HTTP 200.
          const preview = new Image();
          preview.style.cssText = 'width:96px;height:96px;object-fit:contain;display:block';
          const blobURL = URL.createObjectURL(blob);
          try {
            await new Promise(function (resolve, reject) {
              const timeout = setTimeout(function () { reject(new Error('Изображение не загрузилось')); }, 8000);
              preview.onload = function () { clearTimeout(timeout); resolve(); };
              preview.onerror = function () { clearTimeout(timeout); reject(new Error('Браузер не распознал изображение')); };
              preview.src = blobURL;
            });
            item.width = preview.naturalWidth;
            item.height = preview.naturalHeight;
            row.appendChild(preview);
          } finally { URL.revokeObjectURL(blobURL); }
        } else {
          const manifest = JSON.parse(await blob.text());
          item.manifest = manifest;
          for (const icon of manifest.icons || []) {
            await inspect(new URL(icon.src, item.finalURL).href, 'Значок из manifest: ' + icon.sizes, true);
          }
        }
        item.ok = true;
        label.textContent += ' — загружен';
      } catch (error) {
        item.ok = false;
        item.error = String(error.message || error);
        label.textContent += ' — ' + item.error;
      } finally { clearTimeout(timer); }
      const address = document.createElement('small');
      address.textContent = url;
      row.appendChild(address);
    }
    for (const link of links) await inspect(link.href, link.rel + (link.sizes.value ? ' ' + link.sizes.value : ''), link.rel !== 'manifest');
    try {
      if (navigator.serviceWorker) report.registrations = (await navigator.serviceWorker.getRegistrations()).map(function (reg) {
        return {scope: reg.scope, active: reg.active && reg.active.scriptURL};
      });
    } catch (error) { report.errors.push(String(error)); }
    report.finished = Date.now();
    const failed = report.icons.filter(function (item) { return !item.ok; });
    note.textContent = failed.length ? 'Есть ошибки загрузки. Скопируй проверку и пришли её в чат.' : 'Изображения загрузились. Скопируй проверку и пришли её в чат: она покажет настройки именно этого браузера.';
    const output = document.createElement('textarea');
    output.readOnly = true;
    output.value = JSON.stringify(report, null, 2);
    output.style.cssText = 'box-sizing:border-box;display:block;width:100%;height:220px;margin-top:20px;font:12px monospace';
    content.appendChild(output);
    copy.disabled = false;
    copy.onclick = async function () {
      try { await navigator.clipboard.writeText(output.value); copy.textContent = 'Скопировано'; }
      catch (_) { output.focus(); output.select(); copy.textContent = 'Текст выделен — скопируй'; }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, {once: true});
  else check();
})();
