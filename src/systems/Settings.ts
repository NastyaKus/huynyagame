import { Saves } from './SaveSystem';

export interface SettingsData {
  music: number;
  sfx: number;
  /** 0 — медленно, 1 — нормально, 2 — быстро, 3 — мгновенно */
  textSpeed: number;
  touchScale: number;
  touchAlpha: number;
  showTouch: boolean;
}

const DEFAULTS: SettingsData = {
  music: 0.6,
  sfx: 0.8,
  textSpeed: 1,
  touchScale: 1,
  touchAlpha: 0.8,
  showTouch: true,
};

export const Settings = {
  data: { ...DEFAULTS } as SettingsData,

  async load() {
    try {
      const raw = await Saves.getRaw('nc_settings');
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  },

  async save() {
    await Saves.setRaw('nc_settings', JSON.stringify(this.data));
  },

  /** мс на символ */
  charDelay(): number {
    return [42, 24, 10, 0][this.data.textSpeed] ?? 24;
  },
};
