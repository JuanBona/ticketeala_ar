// Test setup: DOM matchers, and the fake API (MSW) reset between tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { fakeApi } from './fake-api.js';

beforeAll(() => fakeApi.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  fakeApi.resetHandlers();
  window.sessionStorage.clear();
});
afterAll(() => fakeApi.close());
