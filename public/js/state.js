/** Simple pub/sub state store */
const listeners = new Map();
const state = {};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  const prev = state[key];
  state[key] = value;
  const subs = listeners.get(key);
  if (subs) {
    for (const fn of subs) {
      fn(value, prev);
    }
  }
}

export function subscribe(key, fn) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

export function getAll() {
  return { ...state };
}
