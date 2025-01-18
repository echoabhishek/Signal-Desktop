
const EventEmitter = require('events');

class MockBrowserWindow extends EventEmitter {
  constructor(options) {
    super();
    this.width = options.width;
    this.height = options.height;
    this.visible = true;
    this.fullScreen = false;
  }

  getSize() {
    return [this.width, this.height];
  }

  setSize(width, height) {
    if (global.isWayland && global.storedWindowSize) {
      if (width === global.storedWindowSize.width && height === global.storedWindowSize.height) {
        this.width = width;
        this.height = height;
      } else {
        console.log(`Prevented resizing to ${width}x${height}`);
      }
    } else {
      this.width = width;
      this.height = height;
    }
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }

  isVisible() {
    return this.visible;
  }

  isFullScreen() {
    return this.fullScreen;
  }

  setFullScreen(fullScreen) {
    this.fullScreen = fullScreen;
  }
}

global.isWayland = true;
global.storedWindowSize = null;

function storeWindowSizeBeforeHide(window) {
  if (global.isWayland) {
    const [width, height] = window.getSize();
    global.storedWindowSize = { width, height };
    console.log(`Storing window size: ${width}x${height}`);
  }
}

function showWindow(window) {
  if (global.isWayland && global.storedWindowSize) {
    window.setSize(global.storedWindowSize.width, global.storedWindowSize.height);
  }
  window.show();
}

// Test cases
let testCases = 0;
let passedTests = 0;

function runTest(testName, testFunction) {
  testCases++;
  console.log(`Running test: ${testName}`);
  try {
    testFunction();
    console.log(`Test passed: ${testName}`);
    passedTests++;
  } catch (error) {
    console.error(`Test failed: ${testName}`);
    console.error(error);
  }
}

// Test 1: Initial window size
runTest('Initial window size', () => {
  const window = new MockBrowserWindow({ width: 800, height: 600 });
  const [width, height] = window.getSize();
  if (width !== 800 || height !== 600) {
    throw new Error(`Unexpected initial size: ${width}x${height}`);
  }
});

// Test 2: Hide and show window
runTest('Hide and show window', () => {
  const window = new MockBrowserWindow({ width: 800, height: 600 });
  const initialSize = window.getSize();
  storeWindowSizeBeforeHide(window);
  window.hide();
  showWindow(window);
  const newSize = window.getSize();
  if (newSize[0] !== initialSize[0] || newSize[1] !== initialSize[1]) {
    throw new Error(`Size changed after hide/show: ${newSize[0]}x${newSize[1]}`);
  }
});

// Test 3: Attempt to resize window
runTest('Attempt to resize window', () => {
  const window = new MockBrowserWindow({ width: 800, height: 600 });
  storeWindowSizeBeforeHide(window);
  window.setSize(900, 700);
  const newSize = window.getSize();
  if (newSize[0] !== 800 || newSize[1] !== 600) {
    throw new Error(`Window resized when it shouldn't: ${newSize[0]}x${newSize[1]}`);
  }
});

// Test 4: Multiple hide/show cycles
runTest('Multiple hide/show cycles', () => {
  const window = new MockBrowserWindow({ width: 800, height: 600 });
  const initialSize = window.getSize();
  for (let i = 0; i < 5; i++) {
    storeWindowSizeBeforeHide(window);
    window.hide();
    showWindow(window);
  }
  const finalSize = window.getSize();
  if (finalSize[0] !== initialSize[0] || finalSize[1] !== initialSize[1]) {
    throw new Error(`Size changed after multiple hide/show: ${finalSize[0]}x${finalSize[1]}`);
  }
});

console.log(`Tests completed. Passed: ${passedTests}/${testCases}`);
