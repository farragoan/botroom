import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// Mock scrollIntoView (not implemented in jsdom)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock navigator.serviceWorker (not available in jsdom)
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    controller: null,
    ready: Promise.resolve({ showNotification: vi.fn() }),
  },
});

// Mock Notification API (not available in jsdom)
Object.defineProperty(globalThis, 'Notification', {
  writable: true,
  value: Object.assign(
    vi.fn().mockImplementation(() => ({ close: vi.fn() })),
    { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
  ),
});

// MSW setup will happen per-test
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
