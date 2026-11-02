import type Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { bus } from './events';
import { Audio2 } from './Audio';

/** Нативные мелочи Android: ориентация, статус-бар, кнопка «назад», пауза звука. */
export async function initNative(game: Phaser.Game) {
  if (!Capacitor.isNativePlatform()) {
    // в браузере Escape работает как «назад»
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') bus.emit('back');
    });
    return;
  }
  try {
    await StatusBar.hide();
  } catch {
    /* нет статус-бара */
  }
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    /* ориентацию задаёт манифест */
  }
  App.addListener('backButton', () => bus.emit('back'));
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      Audio2.resumeAll();
      game.loop.wake();
    } else {
      Audio2.pauseAll();
      bus.emit('autosave');
      game.loop.sleep();
    }
  });
  bus.on('exit-app', () => App.exitApp());
}
