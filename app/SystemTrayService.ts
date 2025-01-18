// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BrowserWindow, NativeImage } from 'electron';
import { Menu, Tray, app, nativeImage, nativeTheme, screen } from 'electron';
import os from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as log from '../ts/logging/log';
import type { LocalizerType } from '../ts/types/I18N';
import { saveWindowState, restoreWindowState, clearWindowState } from './windowManager';

export type SystemTrayServiceOptionsType = Readonly<{
  i18n: LocalizerType;

  // For testing
  createTrayInstance?: (icon: NativeImage) => Tray;
}>;

/**
 * A class that manages an [Electron `Tray` instance][0]. It's responsible for creating
 * and destroying a `Tray`, and listening to the associated `BrowserWindow`'s visibility
 * state.
 *
 * [0]: https://www.electronjs.org/docs/api/tray
 */
export class SystemTrayService {
  #browserWindow?: BrowserWindow;
  readonly #i18n: LocalizerType;
  #tray?: Tray;
  #isEnabled = false;
  #isQuitting = false;
  #unreadCount = 0;
  #createTrayInstance: (icon: NativeImage) => Tray;

  constructor({ i18n, createTrayInstance }: SystemTrayServiceOptionsType) {
    log.info('System tray service: created');
    this.#i18n = i18n;
    this.#createTrayInstance = createTrayInstance || (icon => new Tray(icon));

    nativeTheme.on('updated', this.#render);
  }

  /**
   * Update or clear the associated `BrowserWindow`. This is used for the hide/show
   * functionality. It attaches event listeners to the window to manage the hide/show
   * toggle in the tray's context menu.
   */
  setMainWindow(newBrowserWindow: undefined | BrowserWindow): void {
    const oldBrowserWindow = this.#browserWindow;
    if (oldBrowserWindow === newBrowserWindow) {
      return;
    }

    log.info(
      `System tray service: updating main window. Previously, there was ${
        oldBrowserWindow ? '' : 'not '
      }a window, and now there is${newBrowserWindow ? '' : ' not'}`
    );

    if (oldBrowserWindow) {
      oldBrowserWindow.off('show', this.#render);
      oldBrowserWindow.off('hide', this.#render);
    }

    if (newBrowserWindow) {
      newBrowserWindow.on('show', this.#render);
      newBrowserWindow.on('hide', this.#render);
      newBrowserWindow.on('resize', () => saveWindowState(newBrowserWindow));
      newBrowserWindow.on('maximize', () => saveWindowState(newBrowserWindow));
      newBrowserWindow.on('unmaximize', () => saveWindowState(newBrowserWindow));
      newBrowserWindow.on('enter-full-screen', () => saveWindowState(newBrowserWindow));
      newBrowserWindow.on('leave-full-screen', () => saveWindowState(newBrowserWindow));
    }

    this.#browserWindow = newBrowserWindow;

    this.#render();
  }

  /**
   * Enable or disable the tray icon. Note: if there is no associated browser window (see
   * `setMainWindow`), the tray icon will not be shown, even if enabled.
   */
  setEnabled(isEnabled: boolean): void {
    if (this.#isEnabled === isEnabled) {
      return;
    }

    log.info(`System tray service: ${isEnabled ? 'enabling' : 'disabling'}`);
    this.#isEnabled = isEnabled;

    this.#render();
  }

  /**
   * Update the unread count, which updates the tray icon if it's visible.
   */
  setUnreadCount(unreadCount: number): void {
    if (this.#unreadCount === unreadCount) {
      return;
    }

    log.info(`System tray service: setting unread count to ${unreadCount}`);
    this.#unreadCount = unreadCount;
    this.#render();
  }

  /**
   * Workaround for: https://github.com/electron/electron/issues/32581#issuecomment-1020359931
   *
   * Tray is automatically destroyed when app quits so we shouldn't destroy it
   * twice when all windows will close.
   */
  markShouldQuit(): void {
    log.info('System tray service: markShouldQuit');

    this.#tray = undefined;
    this.#isQuitting = true;
    clearWindowState();
  }

  isVisible(): boolean {
    return this.#tray !== undefined;
  }

  #render = (): void => {
    if (this.#isEnabled && this.#browserWindow) {
      this.#renderEnabled();
      return;
    }
    this.#renderDisabled();
  };

  #renderEnabled() {
    if (this.#isQuitting) {
      log.info('System tray service: not rendering the tray, quitting');
      return;
    }

    log.info('System tray service: rendering the tray');

    this.#tray ??= this.#createTray();
    const tray = this.#tray;
    const browserWindow = this.#browserWindow;

    const toggleWindowVisibility = () => {
      if (browserWindow?.isVisible()) {
        saveWindowState(browserWindow);
        browserWindow.hide();
      } else if (browserWindow) {
        restoreWindowState(browserWindow);
        browserWindow.show();
        focusAndForceToTop(browserWindow);
      }
    };

    try {
      tray.setImage(getIcon(this.#unreadCount));
    } catch (err: unknown) {
      log.warn(
        'System tray service: failed to set preferred image. Falling back...'
      );
      tray.setImage(getDefaultIcon());
    }

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: browserWindow.isVisible()
            ? this.#i18n('hide')
            : this.#i18n('show'),
          click: toggleWindowVisibility,
        },
        { type: 'separator' },
        {
          label: this.#i18n('quit'),
          click: () => {
            app.quit();
          },
        },
      ])
    );

    tray.on('click', toggleWindowVisibility);

    tray.setToolTip(this.#i18n('icu:signalDesktop'));
  }

  /**
   * This is exported for testing, because Electron doesn't have any easy way to hook
   * into the existing tray instances. It should not be used by "real" code.
   */
  _getTray(): undefined | Tray {
    return this.#tray;
  }
}

const Variant = {
  Size16: { size: 16, scaleFactor: 1 },
  Size32: { size: 32, scaleFactor: 2 },
  Size48: { size: 48, scaleFactor: 3 },
  Size256: { size: 256, scaleFactor: 16 },
} as const;

const Variants = Object.values(Variant);

function getDisplaysMaxScaleFactor(): number {
  const displays = screen.getAllDisplays();
  const scaleFactors = displays
    .map(display => display.scaleFactor)
    .filter(scaleFactor => Number.isFinite(scaleFactor) && scaleFactor > 1.0);
  return Math.max(1.0, ...scaleFactors);
}

function getVariantForScaleFactor(scaleFactor: number) {
  const match = Variants.find(variant => {
    return variant.scaleFactor >= scaleFactor;
  });

  return match ?? Variant.Size32;
}

function getTrayIconImagePath(size: number, unreadCount: number): string {
  let dirName: string;
  let fileName: string;

  if (unreadCount === 0) {
    dirName = 'base';
    fileName = `signal-tray-icon-${size}x${size}-base.png`;
  } else if (unreadCount < 10) {
    dirName = 'alert';
    fileName = `signal-tray-icon-${size}x${size}-alert-${unreadCount}.png`;
  } else {
    dirName = 'alert';
    fileName = `signal-tray-icon-${size}x${size}-alert-9+.png`;
  }

  const iconPath = join(
    __dirname,
    '..',
    'images',
    'tray-icons',
    dirName,
    fileName
  );

  return iconPath;
}
  } else {
    // Windows/macOS: Responsive tray icons
    image = nativeImage.createEmpty();

    for (const variant of Variants) {
      const iconPath = getTrayIconImagePath(variant.size, unreadCount);
      const buffer = readFileSync(iconPath);
      image.addRepresentation({
        buffer,
        width: variant.size,
        height: variant.size,
        scaleFactor: variant.scaleFactor,
      });
    }
  }

  TrayIconCache.set(cacheKey, image);

  return image;
}

let defaultIcon: undefined | NativeImage;
function getDefaultIcon(): NativeImage {
  defaultIcon ??= getIcon(0);
  return defaultIcon;
}

export function focusAndForceToTop(browserWindow: BrowserWindow): void {
  // On some versions of GNOME the window may not be on top when restored.
  // This trick should fix it.
  // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
  browserWindow.setAlwaysOnTop(true);
  browserWindow.focus();
  browserWindow.setAlwaysOnTop(false);
}
