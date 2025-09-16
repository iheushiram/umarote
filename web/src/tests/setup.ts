// Simple localStorage polyfill for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  } as any;
}

// Ensure fetch exists (Node >= 18 has global fetch). If not, provide a minimal stub to avoid ReferenceError.
if (typeof globalThis.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  globalThis.fetch = async (_input: any, _init?: any) => {
    throw new Error('global fetch is not available. Tests should stub fetch with vi.fn().');
  };
}

