import { app, BrowserWindow } from 'electron';
import { isWayland } from './utils/platform';

// ... other imports and code ...

async function createWindow() {
  const mainWindow = new BrowserWindow({
    // ... existing options ...
    show: false, // Ensure the window is not shown immediately
  });

  // ... other setup code ...

  if (isWayland()) {
    mainWindow.webContents.once('did-finish-load', async () => {
      getLogger().info('main window did-finish-load on Wayland');
      await showWindow(mainWindow);
    });
  } else {
    mainWindow.once('ready-to-show', async () => {
      getLogger().info('main window is ready-to-show');
      await showWindow(mainWindow);
    });
  }

  // ... rest of the createWindow function ...
}

async function showWindow(window: BrowserWindow) {
  // Perform any necessary checks or operations before showing the window
  window.show();
  window.focus();
  getLogger().info('Window shown and focused');
}

// ... rest of the file ...
