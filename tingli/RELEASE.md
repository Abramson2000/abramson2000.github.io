# Tingli — как выпускать уроки (единый порядок)

_Для меня (Да Мин) и для любого агента, который берётся править Тингли. Цель: не разойтись в двух копиях данных и не откатить чужую работу._

## Главное: одно место правды для данных

В `index.html` данные курса **вшиты внутрь страницы** (offline-бандл: `const UNITS/EXTRA_UNITS/IDV_UNITS/BIZ_UNITS = [...]`),
чтобы приложение стартовало без сети. Файлы `data/units.js`, `data/extra.js`, `data/idv.js`, `data/biz.js` — **источник правды**.

Правило: **руками данные в `index.html` не править.** Порядок такой:

```bash
cd ~/.qclaw-oversea/workspace/tingli      # источник
# 1) правим урок в data/*.js
python3 ../scripts/tingli_build_inline.py --check    # показать рассинхрон (код 1, если разошлось)
python3 ../scripts/tingli_build_inline.py            # перенести данные в index.html байт-в-байт
```

Перенос строго текстовый: массив `const NAME = [...];` копируется из `data/*.js` в `index.html` дословно,
включая форматирование. Поэтому `--check` должен говорить «синхронно ✓» перед деплоем.

## Разделы (какой массив за что отвечает)

| Раздел в приложении | Массив | Файл | src |
|---|---|---|---|
| 基础 / базовый курс | `UNITS` | `data/units.js` | — |
| 语法 — Ли Лэйши (李老师课) | `EXTRA_UNITS` | `data/extra.js` | `teacher` |
| 口语 — устный курс | `IDV_UNITS` | `data/idv.js` | `idv` |
| 团队 — рабочая программа | `BIZ_UNITS` | `data/biz.js` | `team` |

Схема урока: `{unit,label,emoji,zh,ru,src,parts}`; части: `words` (`words:[{zh,py,ru}]`), `text`, `quiz` (**поле `tasks`**), `hw` (**поле `questions`**).

## Аудио

- Конвенция озвучки слов: **по одному слову** (edge-tts `zh-CN-XiaoxiaoNeural`, rate −30 %), паузы ~1 с, 1.6 с каждые 5 слов;
  грамматика — rate −25 %, паузы 0.55 с. Постобработка: `ffmpeg … loudnorm=I=-18:TP=-1.5:LRA=11`, 44.1 кГц моно, 96 kbps.
- Файлы кладём в `audio/` (имена вида `108-w1.mp3`, `108-g.mp3`). URL — `audio/<имя>?v=APP_VER`.
- Ключ текущего аудио в плеере — `audioUnitKey(u)` = `src:unit`, чтобы звук не «протекал» между уроками.

## Шрифт

Если в уроке есть иероглифы, которых нет в подмножестве, пересобрать:

```bash
python3 ~/.qclaw-oversea/workspace/scripts/rebuild_simsun_subset.py
```

(источник глифов — `/System/Library/Fonts/Supplemental/Songti.ttc` #4 STSong). Проверить, что все знаки урока покрыты.

## Версия и деплой

1. Поднять версию в `tingli/index.html` (`APP_VER` + все `?v=`), в `tingli/sw.js` (метка data-build + `?v=`).
2. Скопировать источник в деплой-копию:
   ```bash
   rsync -a --delete --exclude '.wrangler' --exclude 'node_modules' \
     ~/.qclaw-oversea/workspace/tingli/ ~/.qclaw-oversea/workspace/crm-lite/deploy/tingli/
   ```
   (`scripts/tingli_build_inline.py --deploy` делает то же самое одним шагом.)
3. Cloudflare: `cd ~/.qclaw-oversea/workspace/crm-lite/deploy && npx wrangler pages deploy . --commit-dirty=true`
4. GitHub (живой `crmuro.ru`): `bash ~/.qclaw-oversea/workspace/gh-mirror/sync.sh`
5. Проверить живьём: `crmuro.ru/tingli` — версия в подвале, карточка нового урока, 1–2 аудиофайла → HTTP 200, 0 ошибок в консоли.
   GitHub Pages кэширует 600 с: проверять с кэш-бастингом (`?cb=<время>`), 3–4 попытки.

## Чего не делать

- ⚠️ **Не тестировать словарь и прогресс на живом облаке**: приложение объединяет локальные данные с облачным бэкапом (`/api/backup`)
  и пушит обратно — тестовые слова мгновенно попадают в настоящий словарь на всех устройствах.
  Если всё-таки протестировал — почистить бэкап: `curl https://abramson-crm.pages.dev/api/backup`,
  удалить свои записи, затем `curl -X PUT … --data-binary @файл` (перед правкой снять копию).
- Не деплоить `crmuro.ru` из старой копии: сначала сверить `crm-lite/deploy/` с репозиторием
  (`diff -rq`), иначе можно откатить чужую работу (так уже чуть не вышло 27.09.2026).
- Не оставлять данные в двух версиях: правка inline без правки `data/*.js` (или наоборот) = расхождение,
  которое потом ловит `--check`. Сначала `data/*.js`, потом сборщик.
