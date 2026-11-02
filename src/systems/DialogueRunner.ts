import type { Dialogue, DStep } from '../data/types';
import { check } from './conditions';

export type Visible = Extract<DStep, { say: string }> | Extract<DStep, { choice: unknown }> | Extract<DStep, { do: unknown }>;

/** Пошаговый интерпретатор диалогового скрипта (метки, условия, переходы). */
export class DialogueRunner {
  private pc = 0;
  private labels: Record<string, number> = {};

  constructor(private steps: Dialogue) {
    steps.forEach((s, i) => {
      if ('label' in s) this.labels[s.label] = i;
    });
  }

  private jump(label: string) {
    const i = this.labels[label];
    this.pc = i === undefined ? this.steps.length : i + 1;
  }

  /** Следующий шаг, который нужно показать/выполнить. null — конец. */
  next(): Visible | null {
    for (let guard = 0; guard < 1000; guard++) {
      if (this.pc >= this.steps.length) return null;
      const s = this.steps[this.pc++];
      if ('label' in s) continue;
      if ('end' in s) {
        this.pc = this.steps.length;
        return null;
      }
      if ('goto' in s && !('if' in s)) {
        this.jump(s.goto);
        continue;
      }
      if ('if' in s) {
        if (check(s.if)) this.jump(s.goto);
        continue;
      }
      if ('choice' in s) {
        const opts = s.choice.filter((c) => check(c.if));
        return { choice: opts };
      }
      return s as Visible;
    }
    return null;
  }

  choose(goto: string) {
    this.jump(goto);
  }
}
