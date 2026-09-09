// src/services/queueStore.js
//
// Small, pure-ish helper around the per-module localStorage offline queues.
//
// WHY THIS FILE EXISTS (for the next developer):
// Every factory module (carton, laminate, pallet, empty silos, QC checks, ...)
// follows the same pattern: try Firestore, fall back to a localStorage queue,
// flush the queue on reconnect. Historically each service file re-implemented
// JSON.parse(localStorage.getItem(KEY) || '[]') inline, which made the queue
// logic hard to test and easy to subtly diverge. This module centralises the
// storage mechanics behind tiny functions that accept an explicit `storage`
// object, so unit tests can pass an in-memory fake instead of touching the
// real browser localStorage.

function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  throw new Error('No storage available: pass an explicit storage object in non-browser environments.');
}

function safeParse(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readQueue(queueKey, storage = defaultStorage()) {
  return safeParse(storage.getItem(queueKey));
}

export function writeQueue(queueKey, items, storage = defaultStorage()) {
  storage.setItem(queueKey, JSON.stringify(items));
  return items.length;
}

export function pushToQueue(queueKey, item, storage = defaultStorage()) {
  const queue = readQueue(queueKey, storage);
  queue.push(item);
  writeQueue(queueKey, queue, storage);
  return queue.length;
}

export function clearQueue(queueKey, storage = defaultStorage()) {
  storage.removeItem(queueKey);
}

export function getQueueLength(queueKey, storage = defaultStorage()) {
  return readQueue(queueKey, storage).length;
}

export function removeFromQueue(queueKey, predicate, storage = defaultStorage()) {
  const queue = readQueue(queueKey, storage);
  const remaining = queue.filter((item) => !predicate(item));
  writeQueue(queueKey, remaining, storage);
  return remaining;
}

// Minimal in-memory Storage-compatible fake for tests and non-browser usage.
export function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    _dump: () => ({ ...store }),
  };
}
