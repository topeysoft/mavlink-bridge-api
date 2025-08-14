// Jest setup file for additional configuration

// Mock console methods if needed
global.console = {
  ...console,
  // Uncomment to silence console during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock WebSocket for Node.js environment
global.WebSocket = jest.fn() as any;

// Setup any global test utilities here
beforeEach(() => {
  jest.clearAllMocks();
});