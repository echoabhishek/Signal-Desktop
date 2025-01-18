
import { BrowserWindow } from 'electron';
import * as log from '../ts/logging/log';

interface WindowState {
  bounds: Electron.Rectangle;
  isMaximized: boolean;
  isFullScreen: boolean;
}

let savedWindowState: WindowState | null = null;

export function saveWindowState(window: BrowserWindow): void {
  const bounds = window.getBounds();
  const isMaximized = window.isMaximized();
  const isFullScreen = window.isFullScreen();

  savedWindowState = { bounds, isMaximized, isFullScreen };
  log.info('Window state saved:', savedWindowState);
}

export function restoreWindowState(window: BrowserWindow): void {
  if (!savedWindowState) {
    log.info('No saved window state to restore');
    return;
  }

  const { bounds, isMaximized, isFullScreen } = savedWindowState;

  if (isFullScreen) {
    window.setFullScreen(true);
  } else if (isMaximized) {
    window.maximize();
  } else {
    window.setBounds(bounds);
  }

  log.info('Window state restored:', savedWindowState);
}
