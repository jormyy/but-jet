import '@testing-library/jest-dom/vitest'

// Node 22+ installs an experimental `localStorage` global that resolves to
// undefined unless the process was started with --localstorage-file, and it
// shadows the one jsdom provides. Give the tests a real Storage either way.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() { return store.size },
    key: i => [...store.keys()][i] ?? null,
    getItem: k => store.get(String(k)) ?? null,
    setItem: (k, v) => { store.set(String(k), String(v)) },
    removeItem: k => { store.delete(String(k)) },
    clear: () => store.clear(),
  }
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
