const dataStore = new WeakMap<object, Map<string, unknown>>();
let nextId = 0;

export function domDataGet(node: object, key: string): unknown {
  return dataStore.get(node)?.get(key);
}

export function domDataSet(node: object, key: string, value: unknown): void {
  if (value === undefined) {
    const data = dataStore.get(node);
    if (data) {
      data.delete(key);
      if (data.size === 0) dataStore.delete(node);
    }
    return;
  }
  let data = dataStore.get(node);
  if (!data) {
    data = new Map();
    dataStore.set(node, data);
  }
  data.set(key, value);
}

export function domDataGetOrSet(node: object, key: string, value: unknown): unknown {
  let data = dataStore.get(node);
  if (!data) {
    data = new Map();
    dataStore.set(node, data);
  }
  if (data.has(key)) return data.get(key);
  data.set(key, value);
  return value;
}

export function domDataClear(node: object): boolean {
  return dataStore.delete(node);
}

export function domDataNextKey(): string {
  return `__tapout_${nextId++}`;
}
