import type { QuestDef } from './types';

const list: QuestDef[] = [
  {
    id: 'main',
    title: 'Ночные кассеты',
    main: true,
    stages: [
      { text: 'Не спится… Осмотрись в квартире. Кажется, у двери что-то лежит.', on: { pickup: 'cassette_1' } },
      { text: 'Кассета без подписи. Послушай её — проигрыватель на столе.', on: { listen: 'cassette_1' } },
      { text: 'Голос на плёнке кажется знакомым. Выйди на улицу и расспроси соседей.', on: { flag: 'heard_club' } },
      { text: 'Такэда-сан вспомнила клуб «Lavender Note». Его вход — в переулке на востоке улицы.', on: { enter: 'alley' } },
      { text: 'В переулке шумно. Поговори с парнем в наушниках у стены.', on: { flag: 'ren_joined' } },
      { text: 'Клуб заперт. Узнай у владельца, Фудзи-сана, как попасть внутрь.', on: { flag: 'fuji_told' } },
      { text: 'Карта клуба у Мию, она репетирует на крыше. Ключ от пожарной лестницы — у продавщицы в комбини.', on: { pickup: 'roof_key' } },
      { text: 'Поднимись на крышу по пожарной лестнице и найди Мию.', on: { flag: 'miyu_joined' } },
      { text: 'Клубная карта у тебя. Открой «Lavender Note».', on: { enter: 'club' } },
      { text: 'Музыка звучит из пустого зала. Поднимись к сцене.', on: { flag: 'boss_down' } },
      { text: 'Последняя кассета. Кажется, ты знаешь, кому её вернуть.', on: { flag: 'yume_reveal' } },
    ],
    reward: { exp: 100 },
  },
  {
    id: 'cat',
    title: 'Голодная кошка',
    giver: 'Переулок',
    stages: [
      { text: 'Кошка в переулке смотрит очень выразительно. В комбини продают рыбные хлопья.', on: { flag: 'cat_fed' } },
    ],
    reward: { exp: 20 },
  },
  {
    id: 'pass',
    title: 'Потерянный проездной',
    giver: 'Сота',
    stages: [
      { text: 'Сота выронил проездной в переулке, когда убегал от «странного шума».', on: { pickup: 'sota_pass' } },
      { text: 'Верни проездной Соте на улицу.', on: { flag: 'pass_returned' } },
    ],
    reward: { money: 400, exp: 25 },
  },
  {
    id: 'bento',
    title: 'Полуночный заказ',
    giver: 'Аоки',
    stages: [
      { text: 'Отнеси бэнто Такэде-сан — она сидит на скамейке у дома.', on: { flag: 'bento_delivered' } },
    ],
    reward: { money: 300, exp: 20 },
  },
  {
    id: 'diary',
    title: 'Страницы дневника',
    giver: 'Район',
    stages: [
      { text: 'По району разбросаны страницы чьего-то дневника. Найди все три.', on: { items: ['diary_1', 'diary_2', 'diary_3'] } },
    ],
    reward: { items: ['studio_phones'], exp: 30 },
  },
  {
    id: 'disk',
    title: 'Дискета Дзина',
    giver: 'Дзин',
    stages: [
      { text: 'Хакер Дзин потерял дискету где-то на крыше. Говорит, там «все его биты».', on: { pickup: 'jin_disk' } },
      { text: 'Верни дискету Дзину в комбини.', on: { flag: 'disk_returned' } },
    ],
    reward: { items: ['cd_charm'], exp: 25 },
  },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(list.map((q) => [q.id, q]));
export const QUEST_ORDER = list.map((q) => q.id);
