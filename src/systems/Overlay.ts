import { bus } from './events';

/**
 * Стек оверлеев (меню, магазин, сохранения…) для системной кнопки «назад».
 * Если стек пуст — событие уходит базовой сцене как 'back-base'.
 */
const stack: { key: string; close: () => void }[] = [];

export const Overlay = {
  push(key: string, close: () => void) {
    this.remove(key);
    stack.push({ key, close });
  },
  remove(key: string) {
    const i = stack.findIndex((s) => s.key === key);
    if (i >= 0) stack.splice(i, 1);
  },
  isOpen(key?: string) {
    return key ? stack.some((s) => s.key === key) : stack.length > 0;
  },
};

bus.on('back', () => {
  const top = stack[stack.length - 1];
  if (top) top.close();
  else bus.emit('back-base');
});
