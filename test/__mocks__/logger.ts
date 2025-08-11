// Mock logger implementation for tests
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

export const createLogger = jest.fn(() => mockLogger);

// Reset all mocks
export const resetLoggerMocks = () => {
  Object.values(mockLogger).forEach((fn: any) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
  createLogger.mockClear();
};

export default {
  createLogger,
  mockLogger,
  resetLoggerMocks
};
