// Mock DOM elements and events
const mockDocument = {
  listeners: {},
  addEventListener(event, callback) {
    this.listeners[event] = callback;
  },
  removeEventListener(event) {
    delete this.listeners[event];
  },
  dispatchEvent(event) {
    if (this.listeners[event.type]) {
      this.listeners[event.type](event);
    }
  }
};

// Simplified handleOutsideClick function
function handleOutsideClick(element, callback, doc = mockDocument) {
  const outsideClickListener = event => {
    if (!element.contains(event.target)) {
      callback();
    }
  }

  doc.addEventListener('click', outsideClickListener);

  return () => {
    doc.removeEventListener('click', outsideClickListener);
  };
}

// Mock popup element
const mockPopup = {
  contains: () => false,
};

// Mock the setLinkPreviewApplied function
let linkPreviewApplied = true;
const setLinkPreviewApplied = (value) => {
  linkPreviewApplied = value;
  console.log('Link preview applied:', linkPreviewApplied);
};

// Simulate the useEffect hook
const cleanup = handleOutsideClick(mockPopup, () => {
  setLinkPreviewApplied(false);
}, mockDocument);

// Simulate a click event
mockDocument.dispatchEvent({ type: 'click', target: {} });

// Clean up
cleanup();

console.log('Expected: false');
