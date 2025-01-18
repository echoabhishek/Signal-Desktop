const mockDocument = {
  listeners: {},
  addEventListener(event, callback) { this.listeners[event] = callback; },
  removeEventListener(event) { delete this.listeners[event]; },
  dispatchEvent(event) { if (this.listeners[event.type]) this.listeners[event.type](event); }
};

function handleOutsideClick(element, callback, doc = mockDocument) {
  const outsideClickListener = event => {
    if (!element.contains(event.target)) callback();
  }
  doc.addEventListener('click', outsideClickListener);
  return () => doc.removeEventListener('click', outsideClickListener);
}

const mockPopup = { 
  contains: (target) => target.isInside 
};

let linkPreviewApplied = true;
const setLinkPreviewApplied = (value) => {
  linkPreviewApplied = value;
  console.log('Link preview applied:', linkPreviewApplied);
};

const cleanup = handleOutsideClick(mockPopup, () => setLinkPreviewApplied(false), mockDocument);

console.log('Initial state:', linkPreviewApplied);
mockDocument.dispatchEvent({ type: 'click', target: { isInside: true } });
console.log('After inside click:', linkPreviewApplied);
mockDocument.dispatchEvent({ type: 'click', target: { isInside: false } });
console.log('After outside click:', linkPreviewApplied);

cleanup();
