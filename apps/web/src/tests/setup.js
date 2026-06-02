// Polyfill window.navigator.clipboard for @testing-library/user-event v14 + jsdom
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...window.navigator,
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText:  jest.fn().mockResolvedValue(''),
      },
    },
    configurable: true,
    writable: true,
  });
}
