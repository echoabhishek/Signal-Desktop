
const { app, BrowserWindow, screen } = require('electron');

function createWindow() {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    x: externalDisplay ? externalDisplay.bounds.x + 50 : undefined,
    y: externalDisplay ? externalDisplay.bounds.y + 50 : undefined,
  });

  const initialSize = win.getSize();
  const initialPosition = win.getPosition();

  win.on('show', () => {
    if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
      if (!win.isMaximized() && !win.isFullScreen()) {
        win.setSize(initialSize[0], initialSize[1]);
        win.setPosition(initialPosition[0], initialPosition[1]);
      }
    }
  });

  win.on('hide', () => {
    if (!win.isMaximized() && !win.isFullScreen()) {
      Object.assign(initialSize, win.getSize());
      Object.assign(initialPosition, win.getPosition());
    }
  });

  win.loadFile('index.html');

  // Test cases
  setTimeout(() => {
    console.log('Test 1: Normal hide and show');
    win.hide();
    setTimeout(() => {
      win.show();
      console.log('Window size after show:', win.getSize());
      console.log('Window position after show:', win.getPosition());
    }, 1000);
  }, 1000);

  setTimeout(() => {
    console.log('Test 2: Maximize, hide, and show');
    win.maximize();
    win.hide();
    setTimeout(() => {
      win.show();
      console.log('Window size after maximize and show:', win.getSize());
      console.log('Is maximized:', win.isMaximized());
    }, 1000);
  }, 4000);

  setTimeout(() => {
    console.log('Test 3: Fullscreen, hide, and show');
    win.setFullScreen(true);
    win.hide();
    setTimeout(() => {
      win.show();
      console.log('Is fullscreen after show:', win.isFullScreen());
    }, 1000);
  }, 7000);

  setTimeout(() => {
    console.log('Test 4: Rapid hide and show');
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        win.hide();
        setTimeout(() => {
          win.show();
          console.log(`Rapid cycle ${i + 1} - Window size:`, win.getSize());
        }, 100);
      }, i * 200);
    }
  }, 10000);

  setTimeout(() => {
    console.log('Test 5: Resize, hide, and show');
    win.setSize(1000, 800);
    win.hide();
    setTimeout(() => {
      win.show();
      console.log('Window size after resize and show:', win.getSize());
    }, 1000);
  }, 13000);

  setTimeout(() => {
    console.log('Test 6: Move to second display (if available)');
    if (externalDisplay) {
      win.setBounds({
        x: externalDisplay.bounds.x + 100,
        y: externalDisplay.bounds.y + 100,
        width: 800,
        height: 600
      });
      win.hide();
      setTimeout(() => {
        win.show();
        console.log('Window position after move and show:', win.getPosition());
      }, 1000);
    } else {
      console.log('No external display available, skipping test 6');
    }
  }, 16000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
