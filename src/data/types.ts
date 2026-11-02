export type Mood = 'lofi' | 'rock' | 'synth' | 'ballad';
export type Dir = 'down' | 'left' | 'right' | 'up';

export interface Stats {
  maxHp: number;
  maxSp: number;
  atk: number;
  def: number;
  mag: number;
  spd: number;
}

// ───────── Предметы ─────────
export type ItemKind = 'consumable' | 'key' | 'cassette' | 'note' | 'equip';

export interface ItemEffect {
  hp?: number;
  /** доля от макс. HP (0..1) */
  hpPct?: number;
  sp?: number;
  /** воскрешение с долей HP (0..1) */
  revive?: number;
  /** действует на весь отряд */
  all?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  icon: string;
  price?: number;
  effect?: ItemEffect;
  /** можно использовать в бою */
  battle?: boolean;
  /** можно использовать в меню */
  field?: boolean;
  slot?: 'accessory' | 'armor';
  stats?: Partial<Stats>;
  /** текст записки */
  text?: string;
  /** трек кассеты */
  track?: string;
}

// ───────── Навыки ─────────
export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  mood?: Mood;
  power: number;
  sp: number;
  target: 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self';
  kind: 'damage' | 'heal' | 'buff';
  stat: 'atk' | 'mag';
  buff?: { atk?: number; def?: number; turns: number };
}

// ───────── Отряд и враги ─────────
export interface MemberDef {
  id: string;
  name: string;
  base: Stats;
  growth: Stats;
  skills: { level: number; skill: string }[];
  /** уровень при вступлении */
  joinLevel: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  stats: Stats;
  weak: Mood[];
  resist: Mood[];
  skills: string[];
  exp: number;
  money: number;
  drops?: { item: string; chance: number }[];
  boss?: boolean;
  /** для босса: цикл смены слабости */
  cycle?: Mood[];
  art: string;
  scale?: number;
}

// ───────── Условия и эффекты (диалоги/двери/объекты) ─────────
export interface Cond {
  flag?: string;
  notFlag?: string;
  item?: string;
  noItem?: string;
  /** квест на конкретной стадии */
  questAt?: [string, number];
  /** квест начат и стадия >= n */
  questMin?: [string, number];
  questActive?: string;
  questDone?: string;
  questNotStarted?: string;
  cassettes?: number;
  money?: number;
  member?: string;
  any?: Cond[];
}

export type Effect =
  | { flag: string; value?: boolean | number | string }
  | { unflag: string }
  | { give: string; n?: number }
  | { take: string; n?: number }
  | { money: number }
  | { quest: string; stage?: number; complete?: boolean }
  | { battle: string[]; bg?: string; boss?: boolean; music?: string; noFlee?: boolean; winFlag?: string }
  | { join: string }
  | { shop: string }
  | { sleep: true }
  | { cassettePlayer: true }
  | { heal: true }
  | { ending: true }
  | { sfx: string }
  | { music: string | null }
  | { save: true }
  | { wait: number };

// ───────── Диалоги ─────────
export type Emo = 'neutral' | 'smile' | 'surprised' | 'sad' | 'angry' | 'shy' | 'tired';

export type DStep =
  | { say: string; who?: string; emo?: Emo }
  | { choice: { text: string; goto: string; if?: Cond }[] }
  | { if: Cond; goto: string }
  | { label: string }
  | { goto: string }
  | { do: Effect[] }
  | { end: true };

export type Dialogue = DStep[];

// ───────── Квесты ─────────
export type QuestTrigger =
  | { pickup: string }
  | { enter: string }
  | { flag: string }
  | { listen: string }
  | { items: string[] }
  | { win: string };

export interface QuestDef {
  id: string;
  title: string;
  main?: boolean;
  giver?: string;
  stages: { text: string; on?: QuestTrigger }[];
  reward?: { money?: number; items?: string[]; exp?: number };
}

// ───────── Карты ─────────
export type MapObject =
  | { type: 'spawn'; id: string; x: number; y: number; facing?: Dir }
  | { type: 'door'; x: number; y: number; w?: number; h?: number; to: string; spawn: string; cond?: Cond; locked?: string; sfx?: string }
  | { type: 'npc'; id: string; x: number; y: number; sprite: string; dialogue: string; facing?: Dir; wander?: number; cond?: Cond; scale?: number; glow?: number }
  | { type: 'pickup'; id: string; x: number; y: number; item: string; n?: number; cond?: Cond; dialogue?: string; startQuest?: string }
  | { type: 'examine'; x: number; y: number; dialogue: string; cond?: Cond }
  | { type: 'enemy'; id: string; x: number; y: number; kind: string; group: string[]; respawn?: boolean; cond?: Cond; radius?: number }
  | { type: 'sign'; x: number; y: number; text: string; color?: string; size?: number }
  | { type: 'light'; x: number; y: number; r?: number; color?: number; alpha?: number }
  | { type: 'trigger'; id: string; x: number; y: number; w?: number; h?: number; dialogue: string; cond?: Cond; once?: boolean };

export interface MapDef {
  id: string;
  name: string;
  music: string;
  /** символ пола под мебелью */
  floor: string;
  rows: string[];
  objects: MapObject[];
  /** цвет и прозрачность ночного затемнения */
  ambient: { color: number; alpha: number };
  battleBg: string;
  particles?: 'petals' | 'dust' | 'fireflies' | 'stars';
  /** диалог при первом входе (с условием) */
  onEnter?: { dialogue: string; cond?: Cond };
}

// ───────── Сохранения ─────────
export interface MemberState {
  id: string;
  level: number;
  exp: number;
  hp: number;
  sp: number;
  equip: { accessory?: string; armor?: string };
}

export interface QuestState {
  stage: number;
  done: boolean;
}

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  map: string;
  x: number;
  y: number;
  facing: Dir;
  flags: Record<string, boolean | number | string>;
  inv: Record<string, number>;
  money: number;
  quests: Record<string, QuestState>;
  party: MemberState[];
  cleared: string[];
  track: string | null;
  seenWeak: string[];
}
