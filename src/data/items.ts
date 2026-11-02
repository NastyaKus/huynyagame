import type { ItemDef } from './types';

const list: ItemDef[] = [
  // ── расходники ──
  { id: 'onigiri', name: 'Онигири с лососем', desc: 'Тёплый, будто только что из витрины. Восстанавливает 45 HP.', kind: 'consumable', icon: 'onigiri', price: 120, effect: { hp: 45 }, battle: true, field: true },
  { id: 'tea', name: 'Холодный чай', desc: 'Жасминовый, из автомата. Восстанавливает 15 SP.', kind: 'consumable', icon: 'water', price: 100, effect: { sp: 15 }, battle: true, field: true },
  { id: 'energy', name: 'Энергетик «Neon»', desc: 'Сердце стучит в ритме 140 bpm. +30 HP и +10 SP.', kind: 'consumable', icon: 'can', price: 180, effect: { hp: 30, sp: 10 }, battle: true, field: true },
  { id: 'melonpan', name: 'Мелон-пан', desc: 'Хрустящая корочка и сладкая середина. Восстанавливает 90 HP.', kind: 'consumable', icon: 'bread', price: 220, effect: { hp: 90 }, battle: true, field: true },
  { id: 'ramen', name: 'Рамен-стаканчик', desc: 'Ночная классика. Полностью восстанавливает HP одного союзника.', kind: 'consumable', icon: 'ramen', price: 380, effect: { hpPct: 1 }, battle: true, field: true },
  { id: 'candy', name: 'Мятные леденцы', desc: 'Освежают голову. Восстанавливают 30 SP.', kind: 'consumable', icon: 'candy', price: 260, effect: { sp: 30 }, battle: true, field: true },
  { id: 'pill', name: 'Таблетка от мигрени', desc: 'Шум в голове стихает. Весь отряд: +35 HP.', kind: 'consumable', icon: 'pill', price: 450, effect: { hp: 35, all: true }, battle: true, field: true },
  { id: 'star_candy', name: 'Звёздная карамель', desc: 'Говорят, её вкус возвращает даже тех, кто потерял голос. Воскрешает с 50% HP.', kind: 'consumable', icon: 'heart', price: 600, effect: { revive: 0.5 }, battle: true, field: true },

  // ── ключевые ──
  { id: 'walkman', name: 'Кассетный плеер', desc: 'Старенький, но живой. Позволяет слушать найденные кассеты где угодно.', kind: 'key', icon: 'walkman' },
  { id: 'fish_flakes', name: 'Рыбные хлопья', desc: 'Пахнут морем и немного — счастьем. Для кошек.', kind: 'key', icon: 'fish', price: 150 },
  { id: 'bento', name: 'Бэнто для Такэды-сан', desc: 'Аккуратно завёрнуто в платок с журавликами.', kind: 'key', icon: 'bento' },
  { id: 'sota_pass', name: 'Проездной Соты', desc: 'Школьный проездной. На обороте — наклейка с кроликом.', kind: 'key', icon: 'ticket' },
  { id: 'roof_key', name: 'Ключ от крыши', desc: 'Тяжёлый латунный ключ от решётки пожарной лестницы.', kind: 'key', icon: 'key' },
  { id: 'club_card', name: 'Клубная карта', desc: '«Lavender Note · STAFF». Пластик потёрт на углах.', kind: 'key', icon: 'card' },
  { id: 'jin_disk', name: 'Дискета Дзина', desc: 'Подписано маркером: «НЕ ФОРМАТИРОВАТЬ!!»', kind: 'key', icon: 'floppy' },

  // ── снаряжение ──
  { id: 'old_headphones', name: 'Старые наушники', desc: 'Розовые накладки протёрлись. +2 MAG.', kind: 'equip', icon: 'headphones', slot: 'accessory', stats: { mag: 2 } },
  { id: 'cd_charm', name: 'Диск-оберег', desc: 'Царапины на нём складываются в мелодию. +3 DEF, +2 SPD.', kind: 'equip', icon: 'cd', slot: 'accessory', price: 900, stats: { def: 3, spd: 2 } },
  { id: 'glowstick', name: 'Светящаяся палочка', desc: 'С концерта, которого не было. +4 ATK.', kind: 'equip', icon: 'glowstick', slot: 'accessory', price: 700, stats: { atk: 4 } },
  { id: 'plush', name: 'Брелок-зайчик', desc: 'Мягкий и упрямый. +15 HP, +5 SP.', kind: 'equip', icon: 'plush', slot: 'accessory', stats: { maxHp: 15, maxSp: 5 } },
  { id: 'denim', name: 'Джинсовка оверсайз', desc: 'Тёплая, с нашивкой-кассетой. +4 DEF.', kind: 'equip', icon: 'jacket', slot: 'armor', price: 1200, stats: { def: 4 } },
  { id: 'studio_phones', name: 'Студийные наушники', desc: 'Слышно каждый шорох мира. +6 MAG, +2 SPD.', kind: 'equip', icon: 'headphones', slot: 'accessory', stats: { mag: 6, spd: 2 } },

  // ── записки ──
  { id: 'flyer', name: 'Флаер «Lavender Note»', desc: 'Выцветший флаер с концерта.', kind: 'note', icon: 'memo',
    text: 'LAVENDER NOTE · живая музыка каждую пятницу\n\nСпециальный гость: ЮМЭ — «Песни для тех, кто не спит».\n\nВход по клубным картам. Внизу от руки: «последний сет — 31.10»' },
  { id: 'clipping', name: 'Газетная вырезка', desc: 'Заметка из районной газеты.', kind: 'note', icon: 'memo',
    text: '«Клуб Lavender Note закрывается»\n\nВладелец клуба, г-н Фудзи, объявил о закрытии заведения после того, как постоянная исполнительница Юмэ прервала выступление и покинула сцену. «Она просто перестала петь, — говорит он. — Будто кто-то выключил звук».' },
  { id: 'diary_1', name: 'Страница дневника (1)', desc: 'Почерк мелкий и аккуратный.', kind: 'note', icon: 'diary',
    text: '…когда я пою, район становится тише. Фонари гудят в тональности ля, автоматы на углу — почти в ми. Я записываю всё на кассеты, чтобы ничего не потерялось.' },
  { id: 'diary_2', name: 'Страница дневника (2)', desc: 'Края страницы смяты.', kind: 'note', icon: 'diary',
    text: '…на сцене сегодня я услышала эхо. Оно пело мои песни раньше меня. Фудзи-сан говорит, что это акустика. Но эхо улыбалось.' },
  { id: 'diary_3', name: 'Страница дневника (3)', desc: 'Последняя страница, чернила расплылись.', kind: 'note', icon: 'diary',
    text: '…я оставлю песни городу. Разложу кассеты там, где мне было хорошо. Может, кто-нибудь, кто тоже не спит, найдёт их. Тогда я, наверное, смогу снова петь.' },
  { id: 'setlist', name: 'Сет-лист', desc: 'Листок, приклеенный скотчем к сцене.', kind: 'note', icon: 'memo',
    text: '1. Кассета без подписи\n2. Неоновый дождь\n3. Комбини в 3 ночи\n4. Кошачий переулок\n5. Над проводами\n6. Lavender Note\n\n(бис — ?)' },

  // ── кассеты ──
  { id: 'cassette_1', name: 'Кассета без подписи', desc: 'Лежала у двери. Внутри — тихий голос и шум дождя.', kind: 'cassette', icon: 'cassette', track: 'tape1' },
  { id: 'cassette_2', name: '«Неоновый дождь»', desc: 'Синтезаторы, похожие на капли по вывеске.', kind: 'cassette', icon: 'cassette2', track: 'tape2' },
  { id: 'cassette_3', name: '«Комбини в 3 ночи»', desc: 'Пищит касса, звенит дверной колокольчик, а поверх — колыбельная.', kind: 'cassette', icon: 'cassette', track: 'tape3' },
  { id: 'cassette_4', name: '«Кошачий переулок»', desc: 'Ленивый грув. Кажется, кто-то мурлычет в такт.', kind: 'cassette', icon: 'cassette2', track: 'tape4' },
  { id: 'cassette_5', name: '«Над проводами»', desc: 'Песня с высоты. Ветер в микрофоне.', kind: 'cassette', icon: 'cassette', track: 'tape5' },
  { id: 'cassette_6', name: '«Lavender Note»', desc: 'Последняя песня. На наклейке: «для тех, кто не спит».', kind: 'cassette', icon: 'cassette2', track: 'tape6' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));
export const CASSETTE_IDS = list.filter((i) => i.kind === 'cassette').map((i) => i.id);

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item: ${id}`);
  return d;
}
