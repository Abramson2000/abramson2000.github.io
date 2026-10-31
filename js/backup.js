// backup.js — выгрузка всей базы CRM в JSON одним файлом.
// Работает от текущей сессии: берёт токен из localStorage, ходит в Supabase REST.
(function () {
  var URL = 'https://mkehzkobjxnjobkqeiwt.supabase.co';
  var KEY = 'sb_publishable_4RVlpOkywKmEjsnKsHpRiA_q_Af-f0v';
  var TABLES = ['clinics', 'people', 'notes', 'clinic_private', 'dicts', 'user_managers', 'sales_monthly', 'clinic_people'];

  function token() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          if (v && v.access_token) return v.access_token;
        }
      }
    } catch (e) {}
    return null;
  }

  window.exportAllData = async function () {
    var t = token();
    if (!t) { alert('Сначала войдите в базу.'); return; }
    var out = { exportedAt: new Date().toISOString(), tables: {} };
    for (var i = 0; i < TABLES.length; i++) {
      var name = TABLES[i];
      try {
        var r = await fetch(URL + '/rest/v1/' + name + '?select=*&limit=20000', {
          headers: { apikey: KEY, Authorization: 'Bearer ' + t }
        });
        out.tables[name] = r.ok ? await r.json() : { error: r.status };
      } catch (e) {
        out.tables[name] = { error: String(e.message || e) };
      }
    }
    var blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crm-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  };
})();
