const { JSDOM } = require('jsdom');
const { TextStoryCreator } = require('./ts/components/TextStoryCreator');
const React = require('react');
const ReactDOM = require('react-dom');

// Mock the necessary dependencies
global.window = new JSDOM('<!doctype html><html><body></body></html>').window;
global.document = global.window.document;
global.navigator = global.window.navigator;

// Mock the necessary props
const mockProps = {
  i18n: (key) => key,
  onClose: () => {},
  onDone: () => {},
  // Add other necessary props here
};

// Create a test component
const TestComponent = () => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (containerRef.current) {
      ReactDOM.render(<TextStoryCreator {...mockProps} />, containerRef.current);
    }
  }, []);

  return <div ref={containerRef}></div>;
};

// Render the test component
const container = document.createElement('div');
document.body.appendChild(container);
ReactDOM.render(<TestComponent />, container);

// Simulate clicking outside the link preview popup
setTimeout(() => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  document.body.dispatchEvent(event);

  // Check if the link preview popup is closed
  const linkPreviewPopup = document.querySelector('.StoryCreator__link-preview-input-popper');
  console.log('Link preview popup is closed:', !linkPreviewPopup);
}, 1000);
