import { Preferences } from '@capacitor/preferences';
import type { SaveData } from '../data/types';
import { migrate } from './GameState';

export interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
  remove(k: string): Promise<void>;
}

/** Capacitor Preferences: на Android — SharedPreferences, в браузере — localStorage. */
const prefsKV: KV = {
  async get(k) {
    return (await Preferences.get({ key: k })).value;
  },
  async set(k, v) {
    await Preferences.set({ key: k, value: v });
  },
  async remove(k) {
    await Preferences.remove({ key: k });
  },
};

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    async get(k) {
      return m.get(k) ?? null;
    },
    async set(k, v) {
      m.set(k, v);
    },
    async remove(k) {
      m.delete(k);
    },
  };
}

let kv: KV = prefsKV;
export function setStorage(s: KV) {
  kv = s;
}

export const SLOTS = ['auto', '1', '2', '3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SlotInfo {
  slot: Slot;
  data: SaveData | null;
}

const key = (slot: Slot) => `nc_save_${slot}`;

export const Saves = {
  async save(slot: Slot, data: SaveData): Promise<void> {
    const copy: SaveData = JSON.parse(JSON.stringify(data));
    copy.savedAt = Date.now();
    await kv.set(key(slot), JSON.stringify(copy));
  },

  async load(slot: Slot): Promise<SaveData | null> {
    const raw = await kv.get(key(slot));
    if (!raw) return null;
    try {
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn('Повреждённое сохранение', slot, e);
      return null;
    }
  },

  async list(): Promise<SlotInfo[]> {
    return Promise.all(SLOTS.map(async (slot) => ({ slot, data: await this.load(slot) })));
  },

  async latest(): Promise<SlotInfo | null> {
    const all = (await this.list()).filter((s) => s.data);
    if (!all.length) return null;
    return all.sort((a, b) => b.data!.savedAt - a.data!.savedAt)[0];
  },

  async remove(slot: Slot) {
    await kv.remove(key(slot));
  },

  async getRaw(k: string) {
    return kv.get(k);
  },
  async setRaw(k: string, v: string) {
    return kv.set(k, v);
  },
};
