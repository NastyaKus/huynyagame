import manifest from 'virtual:asset-manifest';
import { TRACKS, type TrackDef } from '../data/tracks';
import { Settings } from './Settings';

/**
 * Музыка и звуки.
 * Если в public/assets/music/<id>.(ogg|mp3) лежит файл — играем его.
 * Иначе играет процедурный city-pop секвенсор на WebAudio.
 */

const fileFor = (dir: string, id: string) => manifest.find((f) => new RegExp(`^${dir}/${id}\\.(ogg|mp3|wav|m4a)$`, 'i').test(f));

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Sequencer {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private melody: (number | null)[] = [];
  private out: GainNode;
  private noiseBuf: AudioBuffer;
  private delay: DelayNode;
  private hissNode: AudioBufferSourceNode | null = null;

  constructor(private ctx: AudioContext, dest: AudioNode, private t: TrackDef, noise: AudioBuffer) {
    this.noiseBuf = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    // мечтательное эхо
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = (60 / t.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.delay.connect(lp);
    lp.connect(fb);
    fb.connect(this.delay);
    lp.connect(this.out);
    this.buildMelody();
  }

  private buildMelody() {
    const rnd = mulberry(this.t.seed);
    const steps = this.t.chords.length * 16;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    let prev = 2;
    this.melody = [];
    for (let i = 0; i < steps; i++) {
      const strong = i % 4 === 0;
      const p = strong ? this.t.density + 0.15 : this.t.density * 0.5;
      if (rnd() < p) {
        const chord = this.t.chords[Math.floor(i / 16)];
        let note: number;
        if (strong && rnd() < 0.6) {
          note = chord[Math.floor(rnd() * chord.length)] % 12;
          note += 12;
        } else {
          prev = Math.max(0, Math.min(scale.length - 1, prev + Math.floor(rnd() * 5) - 2));
          note = scale[prev] + 12;
        }
        this.melody.push(note);
      } else this.melody.push(null);
    }
  }

  start() {
    const now = this.ctx.currentTime;
    this.nextTime = now + 0.08;
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(1, now + 1.2);
    if (this.t.hiss) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 3000;
      const g = this.ctx.createGain();
      g.gain.value = 0.012;
      src.connect(f).connect(g).connect(this.out);
      src.start();
      this.hissNode = src;
    }
    this.timer = window.setInterval(() => this.tick(), 40);
  }

  stop(fade = 0.6) {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    const out = this.out;
    const hiss = this.hissNode;
    setTimeout(() => {
      try {
        hiss?.stop();
      } catch {
        /* уже остановлен */
      }
      out.disconnect();
    }, fade * 1000 + 100);
  }

  private tick() {
    const spb = 60 / this.t.bpm / 4; // длительность 1/16
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.schedule(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % (this.t.chords.length * 16);
    }
  }

  private schedule(step: number, time: number, spb: number) {
    const t = this.t;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = t.chords[bar].map((n) => n + t.root);

    // пэд — в начале такта
    if (s === 0) for (const n of chord) this.tone(mtof(n), time, spb * 16, t.pad, 0.028, 0.35, 900, 0.004);

    // бас
    const bassRoot = chord[0] - 12;
    const bassPat: Record<string, number[]> = {
      soft: [0, 8],
      walk: [0, 3, 6, 8, 10, 14],
      drive: [0, 2, 4, 6, 8, 10, 12, 14],
      none: [],
    };
    if (bassPat[t.bass].includes(s)) {
      const n = t.bass === 'walk' && s === 14 ? bassRoot + 7 : t.bass === 'walk' && s === 6 ? bassRoot + 12 : bassRoot;
      this.tone(mtof(n), time, spb * (t.bass === 'soft' ? 6 : 1.8), 'triangle', t.bass === 'drive' ? 0.11 : 0.13, 0.01, 600);
    }

    // ударные
    if (t.drums !== 'none') {
      const kick = t.drums === 'battle' ? [0, 6, 8, 11] : t.drums === 'beat' ? [0, 7, 10] : [0, 8];
      const snare = t.drums === 'soft' ? [] : [4, 12];
      if (kick.includes(s)) this.kick(time, t.drums === 'soft' ? 0.35 : 0.6);
      if (snare.includes(s)) this.noise(time, 0.12, 1800, 'bandpass', t.drums === 'battle' ? 0.16 : 0.1);
      if (s % 2 === 0 || t.drums === 'battle') this.noise(time, 0.03, 8000, 'highpass', s % 4 === 2 ? 0.05 : 0.025);
    }

    // мелодия
    const m = this.melody[step];
    if (m !== null && m !== undefined) {
      const freq = mtof(t.root + 12 + m);
      const g = (t.leadGain ?? 0.7) * 0.09;
      this.tone(freq, time, spb * 2.6, t.lead, g, 0.01, 3200, 0.005, true);
    }
  }

  private tone(freq: number, time: number, dur: number, type: OscillatorType, gain: number, attack: number, cutoff: number, detune = 0, send = false) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = (Math.random() - 0.5) * 1200 * detune;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    osc.connect(f).connect(g).connect(this.out);
    if (send) g.connect(this.delay);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private kick(time: number, vol: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    g.gain.setValueAtTime(vol * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    o.connect(g).connect(this.out);
    o.start(time);
    o.stop(time + 0.25);
  }

  private noise(time: number, dur: number, freq: number, type: BiquadFilterType, vol: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(time, Math.random() * 0.5);
    src.stop(time + dur + 0.02);
  }
}

class AudioManager {
  ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private seq: Sequencer | null = null;
  private el: HTMLAudioElement | null = null;
  current: string | null = null;
  private pending: string | null = null;

  /** Вызывать из обработчика жеста пользователя (политика автоплея). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(comp);
      this.sfxGain.connect(comp);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      this.loadSfx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.current = null;
      this.play(p);
    }
  }

  applyVolume() {
    if (!this.ctx) return;
    this.musicGain.gain.value = Settings.data.music * 0.9;
    this.sfxGain.gain.value = Settings.data.sfx * 0.8;
    if (this.el) this.el.volume = Settings.data.music * 0.85;
  }

  play(id: string | null) {
    if (id === this.current) return;
    this.current = id;
    this.stopCurrent();
    if (!id) return;
    if (!this.ctx) {
      this.pending = id;
      return;
    }
    const file = fileFor('music', id);
    if (file) {
      // плавное появление трека
      const el = new Audio(`assets/${file}`);
      el.loop = true;
      el.volume = 0;
      this.el = el;
      el.play().catch(() => {
        if (this.el === el) this.pending = id;
      });
      const target = () => Settings.data.music * 0.85;
      const fade = setInterval(() => {
        if (this.el !== el) return clearInterval(fade);
        el.volume = Math.min(target(), el.volume + 0.04);
        if (el.volume >= target()) clearInterval(fade);
      }, 50);
      return;
    }
    const def = TRACKS[id];
    if (!def) return;
    this.seq = new Sequencer(this.ctx, this.musicGain, def, this.noise);
    this.seq.start();
  }

  private stopCurrent() {
    this.seq?.stop();
    this.seq = null;
    if (this.el) {
      const el = this.el;
      this.el = null;
      const fade = setInterval(() => {
        el.volume = Math.max(0, el.volume - 0.08);
        if (el.volume <= 0) {
          clearInterval(fade);
          el.pause();
        }
      }, 40);
    }
  }

  pauseAll() {
    this.ctx?.suspend();
    this.el?.pause();
  }
  resumeAll() {
    this.ctx?.resume();
    this.el?.play().catch(() => {});
  }

  /** Короткие процедурные звуки интерфейса и боя. */
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayed = new Map<string, number>();

  /** Декодировать звуки из public/assets/sfx один раз — дальше играют мгновенно. */
  private loadSfx() {
    const ctx = this.ctx!;
    for (const f of manifest.filter((x) => x.startsWith('sfx/'))) {
      const name = f.replace(/^sfx\//, '').replace(/\.[a-z0-9]+$/i, '');
      fetch(`assets/${f}`)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => this.buffers.set(name, buf))
        .catch((e) => console.warn('sfx', name, e));
    }
  }

  sfx(name: 'click' | 'confirm' | 'cancel' | 'pickup' | 'cassette' | 'hit' | 'weak' | 'heal' | 'levelup' | 'door' | 'encounter' | 'victory' | 'miss' | 'buff' | 'text' | 'locked' | 'down') {
    const ctx = this.ctx;
    if (!ctx) return;
    const buf = this.buffers.get(name);
    if (buf) {
      // не накладывать один и тот же звук чаще, чем раз в 40 мс
      const now = ctx.currentTime;
      if (now - (this.lastPlayed.get(name) ?? -1) < 0.04) return;
      this.lastPlayed.set(name, now);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = SFX_GAIN[name] ?? 0.8;
      if (name === 'text') src.playbackRate.value = 0.95 + Math.random() * 0.15;
      src.connect(g).connect(this.sfxGain);
      src.start();
      return;
    }
    if (fileFor('sfx', name)) return; // файл есть, но ещё декодируется
    const t = ctx.currentTime + 0.005;
    const blip = (f: number, d: number, type: OscillatorType = 'sine', v = 0.18, at = 0, slideTo?: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + at);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + at + d);
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(v, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + d);
      o.connect(g).connect(this.sfxGain);
      o.start(t + at);
      o.stop(t + at + d + 0.02);
    };
    const nz = (d: number, f: number, v = 0.25, type: BiquadFilterType = 'lowpass') => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(fl).connect(g).connect(this.sfxGain);
      s.start(t);
      s.stop(t + d);
    };
    switch (name) {
      case 'click': blip(1320, 0.05, 'triangle', 0.12); break;
      case 'text': blip(900 + Math.random() * 200, 0.025, 'triangle', 0.035); break;
      case 'confirm': blip(988, 0.08, 'triangle', 0.14); blip(1480, 0.12, 'triangle', 0.12, 0.06); break;
      case 'cancel': blip(740, 0.08, 'triangle', 0.12); blip(494, 0.12, 'triangle', 0.1, 0.06); break;
      case 'pickup': [784, 988, 1175, 1568].forEach((f, i) => blip(f, 0.14, 'triangle', 0.12, i * 0.06)); break;
      case 'cassette': [523, 659, 784, 988, 1319].forEach((f, i) => blip(f, 0.3, 'sine', 0.14, i * 0.08)); nz(0.15, 2000, 0.06, 'highpass'); break;
      case 'hit': nz(0.16, 1200, 0.4); blip(160, 0.12, 'square', 0.12, 0, 60); break;
      case 'weak': nz(0.2, 3000, 0.35); blip(880, 0.1, 'square', 0.12); blip(1320, 0.18, 'square', 0.1, 0.08); break;
      case 'down': blip(330, 0.2, 'sawtooth', 0.08, 0, 110); break;
      case 'miss': blip(600, 0.15, 'sine', 0.1, 0, 300); break;
      case 'heal': [659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.25, 'sine', 0.1, i * 0.05)); break;
      case 'buff': [523, 784, 1047].forEach((f, i) => blip(f, 0.2, 'triangle', 0.1, i * 0.05)); break;
      case 'levelup': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => blip(f, 0.18, 'triangle', 0.13, i * 0.07)); break;
      case 'door': nz(0.25, 500, 0.18); blip(220, 0.15, 'sine', 0.08); break;
      case 'locked': blip(200, 0.08, 'square', 0.08); blip(180, 0.1, 'square', 0.08, 0.09); break;
      case 'encounter': blip(220, 0.5, 'sawtooth', 0.1, 0, 880); nz(0.4, 4000, 0.15, 'highpass'); break;
      case 'victory': [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => blip(f, i === 5 ? 0.6 : 0.16, 'triangle', 0.13, i * 0.1)); break;
    }
  }
}

/** Индивидуальная громкость звуков (файловых). */
const SFX_GAIN: Record<string, number> = {
  text: 0.25,
  click: 0.55,
  confirm: 0.6,
  cancel: 0.55,
  victory: 0.75,
  cassette: 0.75,
  levelup: 0.75,
  door: 0.6,
};

export const Audio2 = new AudioManager();
