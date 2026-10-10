/* Offline controls only. No access to words, progress, schedules or sync storage. */
(function (root) {
  'use strict';
  let allBusy = false, unitBusy = false;
  function elements() {
    return { status: document.getElementById('sbOfflineSt'), button: document.getElementById('sbOfflineBtn') };
  }
  function message(data, onProgress) {
    return new Promise(resolve => {
      let timer, channel, finished = false;
      const finish = value => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (channel) channel.port1.close();
        resolve(value);
      };
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => finish(null), data.type === 'precache' || data.type === 'download-files' ? 45000 : 12000); };
      arm();
      if (!('serviceWorker' in navigator)) return finish(null);
      navigator.serviceWorker.ready.then(reg => {
        if (finished) return;
        const sw = reg.active || navigator.serviceWorker.controller;
        if (!sw) return finish(null);
        channel = new MessageChannel();
        channel.port1.onmessage = event => {
          const value = event.data || {};
          if (value.type === 'progress') { arm(); if (onProgress) onProgress(value); return; }
          finish(value);
        };
        sw.postMessage(data, [channel.port2]);
      }).catch(() => finish(null));
    });
  }
  async function protectStorage() {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
  }
  function paint(result, verified) {
    const { status, button } = elements();
    if (!status) return;
    if (!result || result.error) {
      status.textContent = result && result.error || 'Не удалось проверить сохранённые файлы';
      if (button) { button.textContent = 'Проверить и докачать'; button.classList.remove('ready'); }
      return;
    }
    const missing = result.total - result.have;
    const old = result.outdated || 0;
    status.textContent = (verified ? 'Проверено без загрузки: ' : 'Сохранено: ') + result.have + ' из ' + result.total +
      (old ? ' · обновить ' + old : '') + (missing ? ' · не хватает ' + missing : '') +
      (result.totalBytes ? ' · материалы ' + Math.ceil(result.totalBytes / 1048576) + ' МБ' : '');
    if (button) {
      button.classList.toggle('ready', !!result.ready);
      button.textContent = result.ready ? '✓ Доступно без интернета' : '⬇️ Докачать для полёта (' + (missing + old) + ')';
    }
  }
  async function refresh(verified) { paint(await message({ type: verified ? 'verify' : 'status' }), verified); }
  async function downloadAll() {
    if (allBusy || unitBusy) return;
    const { status, button } = elements();
    if (navigator.onLine === false) { await refresh(true); return; }
    allBusy = true;
    await protectStorage();
    if (button) { button.disabled = true; button.classList.remove('ready'); button.textContent = 'Скачиваю…'; }
    try {
      const result = await message({ type: 'precache' }, p => {
        if (status) status.textContent = 'Скачиваю: ' + p.done + ' из ' + p.total + (p.failed ? ' · ошибок ' + p.failed : '');
      });
      if (!result) {
        if (status) status.textContent = 'Загрузка перестала отвечать. Сохранённое не удалено — можно докачать.';
        if (button) button.textContent = 'Проверить и докачать';
      } else {
        paint(result.status || result, false);
        if (result.failed && result.failed.length && status) status.textContent += ' · ошибки загрузки: ' + result.failed.length;
      }
    } finally { allBusy = false; if (button) button.disabled = false; }
  }
  const urls = names => names.map(name => './audio/' + name);
  async function unitState(names) {
    if (!names.length) return null;
    const result = await message({ type: 'unit-status', urls: urls(names) });
    return result && !result.error ? { names, done: result.have, total: result.total, outdated: result.outdated || 0 } : { names, done: 0, total: names.length, unknown: true };
  }
  async function refreshUnits(namesForUnit) {
    for (const card of document.querySelectorAll('.unit-card')) {
      const n = Number(card.getAttribute('data-u')), button = card.querySelector('.unit-dl');
      if (!n || !button) continue;
      const state = await unitState(namesForUnit(n));
      if (!state) { button.style.display = 'none'; continue; }
      button.style.display = '';
      const done = state.done === state.total && !state.unknown;
      button.innerHTML = dlSvg(done ? 'check' : 'dl');
      button.className = 'unit-dl ' + (done ? 'done' : state.done ? 'part' : '');
      button.title = done ? 'Аудио сохранено — нажми, чтобы удалить' : state.unknown ? 'Не удалось проверить аудио' : 'Сохранено ' + state.done + ' из ' + state.total + ' — докачать';
    }
  }
  async function downloadUnit(n, event, names, namesForUnit) {
    if (event && event.stopPropagation) event.stopPropagation();
    if (unitBusy || allBusy || !names.length) return;
    const state = await unitState(names);
    if (!state || state.unknown) return;
    if (state.done === state.total && !state.outdated) {
      if (!confirm('Удалить скачанное аудио урока? Без интернета оно больше не откроется.')) return;
      await message({ type: 'remove-files', urls: urls(names) });
      await refreshUnits(namesForUnit); await refresh(false); return;
    }
    if (navigator.onLine === false) { alert('Нет сети. Уже сохранённое аудио доступно; недостающее можно докачать после подключения.'); return; }
    unitBusy = true;
    const button = document.querySelector('.unit-card[data-u="' + n + '"] .unit-dl');
    if (button) { button.disabled = true; button.textContent = '…'; }
    try {
      await protectStorage();
      const result = await message({ type: 'download-files', urls: urls(names) }, p => { if (button) button.textContent = Math.round(p.done / Math.max(1, p.total) * 100) + '%'; });
      if (!result || result.error || result.failed && result.failed.length) {
        const { status } = elements();
        if (status) status.textContent = 'Урок скачан не полностью. Сохранённое осталось — можно докачать.';
      }
    } finally { unitBusy = false; if (button) button.disabled = false; await refreshUnits(namesForUnit); }
  }
  root.TingliOffline = { message, refresh, downloadAll, unitState, refreshUnits, downloadUnit };
})(window);
