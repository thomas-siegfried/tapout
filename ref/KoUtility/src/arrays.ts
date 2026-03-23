declare global {
  interface Array<T> {
    distinct(): Array<T>;
    sortBy(fn: (t: T) => any): Array<T>;
    sum(fn: (t: T) => number): number;
  }
}

Array.prototype.distinct = function <T>(this: T[]): T[] {
  return [...new Set(this)];
};
Array.prototype.sortBy = function <T>(this: T[], fn: (item: T) => any) {
  return this.sort((a, b) => {
    const aVal = fn(a);
    const bVal = fn(b);

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal);
    }

    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }

    // Handle numbers and other comparable values
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
};
Array.prototype.sum = function <T>(this: T[], fn: (item: T) => number) {
  return this.reduce((prev, item: T) => prev + fn(item), 0);
};

// Make this a module to allow global declarations
export {};
