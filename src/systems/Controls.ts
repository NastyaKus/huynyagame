/**
 * Единая точка ввода: тач-джойстик и кнопки HUD + клавиатура пишут сюда,
 * World читает отсюда.
 */
export const Controls = {
  /** аналоговый вектор движения от джойстика, длина 0..1 */
  stickX: 0,
  stickY: 0,
  /** клавиатура */
  keyX: 0,
  keyY: 0,
  run: false,
  keyRun: false,
  private_interact: false,
  private_menu: false,

  pressInteract() {
    this.private_interact = true;
  },
  pressMenu() {
    this.private_menu = true;
  },
  consumeInteract(): boolean {
    const v = this.private_interact;
    this.private_interact = false;
    return v;
  },
  consumeMenu(): boolean {
    const v = this.private_menu;
    this.private_menu = false;
    return v;
  },
  vector(): { x: number; y: number } {
    let x = this.stickX + this.keyX;
    let y = this.stickY + this.keyY;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  },
  isRunning() {
    return this.run || this.keyRun;
  },
  reset() {
    this.stickX = this.stickY = this.keyX = this.keyY = 0;
    this.run = this.keyRun = false;
    this.private_interact = this.private_menu = false;
  },
};
