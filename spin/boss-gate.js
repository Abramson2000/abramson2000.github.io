// ============ boss-gate: x2 (переписка) и x3 (телефон) — только для владельца ============
// Курсы переделываются с нуля. Пока идёт работа — скрыты от всех, кроме abramson@crm.ru.
// Подключается ПОСЛЕ data.js и bariga-data.js, ДО app.js. Механизм: refreshExtra() в app.js
// фильтрует EXTRA по флагу only==='boss' (виден только владельцу).
(function () {
  // SPIN_DATA — top-level const (глобальная лексическая переменная, НЕ на window)
  if (typeof SPIN_DATA === 'undefined' || !SPIN_DATA.extra) return;
  SPIN_DATA.extra.forEach(function (x) {
    if (x && (x.id === 'x2' || x.id === 'x3')) x.only = 'boss';
  });
})();
