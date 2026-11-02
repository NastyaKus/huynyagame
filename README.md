# Ночные кассеты · night cassettes

Атмосферная top-down JRPG для Android про ночной японский район.
Хана не может уснуть, находит у двери кассету без подписи и идёт по району собирать песни пропавшей певицы,
разговаривать с соседями и отбиваться от «шумов» — обрывков недопетых мелодий.

**Стек:** Phaser 3 · TypeScript · Vite · Capacitor 8 (Android) · Vitest

## Что есть

- **6 локаций:** квартира, улица, комбини, переулок, крыша, клуб «Lavender Note». Коллизии, переходы, ночной свет, неон, лепестки.
- **Тач-управление:** плавающий джойстик (левая половина экрана), кнопка «говорить», зажимаемая «бег», меню. С клавиатуры: WASD/стрелки, Space/E, Shift, M, Esc.
- **Диалоги:** портреты с эмоциями, имя, печать текста, выборы, условия и эффекты.
- **Квесты:** основной сюжет на 11 стадий и 5 побочных квестов, журнал, трекер цели в HUD.
- **Инвентарь:** расходники, снаряжение (аксессуар/одежда), ключевые предметы, записки (читаются), кассеты (слушаются через плеер).
- **Бои как в JRPG:** пошаговые, порядок по скорости. Атака, навыки, предметы, защита, побег.
  Четыре музыкальных «настроения» (Lo-fi / Rock / Synth / Ballad) и слабости к ним.
  Попадание в слабость роняет врага и даёт **«Ещё раз!»**; когда все упали — **«Финальный аккорд»** всем отрядом.
  Босс Резонанс меняет слабость каждые два хода.
- **Отряд:** Хана, Рэн, Мию. Уровни, рост статов, новые навыки.
- **Сохранения:** 3 слота + автосейв (Capacitor Preferences на Android, localStorage в браузере). Настройки громкости, скорости текста и тач-кнопок.
- **Музыка и звуки:** лоу-фай, синтвейв и джаз с OpenGameArt, звуки Kenney — всё CC0 (`docs/CREDITS.md`). Без файлов включается процедурный city pop.
- **Главное меню**, экран поражения, финальные титры главы.

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173 — играть в браузере
npm test             # логика + полное прохождение главы
npm run build        # сборка в dist/
```

## Android

```bash
npm run android:sync                 # build + cap sync
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Нужны JDK 21 и Android SDK (platform 36). Ещё можно открыть папку `android/` в Android Studio.
GitHub Actions (`.github/workflows/android.yml`) собирает APK на каждый пуш, его можно скачать во вкладке Actions → artifacts.

Иконка и сплэш генерируются из портрета: `python3 tools/make_android_icons.py`.

## Структура

```
src/
  main.ts              конфиг Phaser, список сцен
  config.ts            размеры, палитра, скорости
  scenes/              Boot, Preload, Menu, World, Hud, Dialogue, GameMenu, Shop, SaveLoad, Settings, Battle, GameOver, Ending
  systems/             GameState, QuestSystem, BattleEngine (чистая логика), DialogueRunner, Effects, SaveSystem, Audio, Controls, Overlay, Native
  entities/            Player, Npc, FieldEnemy
  ui/widgets.ts        панели, кнопки, списки, полоски
  art/Procedural.ts    процедурные тайлы, мебель, фоны
  data/                maps, dialogues, quests, items, skills, party, enemies, characters, shops, tracks, tiles
public/assets/         картинки и звук (см. docs/ASSETS.md)
tools/                 скрипты нарезки листов и генерации иконок
tests/                 vitest
```

Контент правится в `src/data/`: карты — ASCII-сетки, диалоги — компактные скрипты с метками и условиями,
квесты — стадии с триггерами. Тест `tests/logic.test.ts` проверяет ссылки между ними (двери, спавны, диалоги, предметы),
а `tests/story.test.ts` проходит всю главу целиком.
