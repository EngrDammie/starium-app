import { describe, it, expect } from 'vitest';
import {
  readQueue,
  writeQueue,
  pushToQueue,
  clearQueue,
  getQueueLength,
  removeFromQueue,
  createMemoryStorage,
} from '../queueStore';

describe('queueStore', () => {
  it('reads an empty queue as []', () => {
    const storage = createMemoryStorage();
    expect(readQueue('k', storage)).toEqual([]);
  });

  it('pushes and reads items back', () => {
    const storage = createMemoryStorage();
    pushToQueue('k', { id: 1 }, storage);
    pushToQueue('k', { id: 2 }, storage);
    expect(getQueueLength('k', storage)).toBe(2);
    expect(readQueue('k', storage)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns [] on corrupt JSON instead of throwing', () => {
    const storage = createMemoryStorage({ k: 'not-json{{{' });
    expect(readQueue('k', storage)).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    const storage = createMemoryStorage({ k: JSON.stringify({ a: 1 }) });
    expect(readQueue('k', storage)).toEqual([]);
  });

  it('writeQueue replaces contents and returns length', () => {
    const storage = createMemoryStorage();
    expect(writeQueue('k', [{ a: 1 }, { b: 2 }], storage)).toBe(2);
    expect(readQueue('k', storage)).toHaveLength(2);
  });

  it('clearQueue empties the queue', () => {
    const storage = createMemoryStorage();
    pushToQueue('k', { id: 1 }, storage);
    clearQueue('k', storage);
    expect(readQueue('k', storage)).toEqual([]);
  });

  it('removeFromQueue drops only matching items', () => {
    const storage = createMemoryStorage();
    writeQueue('k', [{ id: 1 }, { id: 2 }, { id: 3 }], storage);
    const remaining = removeFromQueue('k', (item) => item.id === 2, storage);
    expect(remaining.map((i) => i.id)).toEqual([1, 3]);
    expect(readQueue('k', storage).map((i) => i.id)).toEqual([1, 3]);
  });
});
