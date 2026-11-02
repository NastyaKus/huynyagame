type Handler = (...args: any[]) => void;

/** Мини-шина событий без зависимости от Phaser (используется и в тестах). */
export class Emitter {
  private map = new Map<string, Set<Handler>>();
  on(ev: string, fn: Handler): () => void {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.off(ev, fn);
  }
  off(ev: string, fn: Handler) {
    this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, ...args: any[]) {
    this.map.get(ev)?.forEach((fn) => fn(...args));
  }
  clear() {
    this.map.clear();
  }
}

/**
 * Глобальные события:
 *  toast(text, kind?)         — всплывашка в HUD
 *  quest(update)              — квест начат/продвинут/завершён
 *  item(id, n)                — получен предмет
 *  money(n)
 *  levelup(memberId, level)
 *  back()                     — системная кнопка «назад» на Android
 */
export const bus = new Emitter();
