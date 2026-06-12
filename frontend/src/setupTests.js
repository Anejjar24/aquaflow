// jest-dom adds custom matchers: toBeInTheDocument, toHaveTextContent, etc.
import '@testing-library/jest-dom';

// Suppress console.error and console.warn during tests
// (React act() warnings, prop-types warnings, etc. — all intentional in test context)
const originalError = console.error;
const originalWarn  = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    const msg = args[0] ? String(args[0]) : '';
    if (
      msg.includes('Warning:') ||
      msg.includes('ReactDOM.render') ||
      msg.includes('act(') ||
      msg.includes('not wrapped in act')
    ) return;
    originalError(...args);
  };
  console.warn = (...args) => {
    const msg = args[0] ? String(args[0]) : '';
    if (msg.includes('Warning:')) return;
    originalWarn(...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn  = originalWarn;
});
