import {
  Subscribable,
  Subscription,
  isSubscribable,
  type SubscriptionCallback,
} from '#src/index.js';

describe('Subscription', () => {
  it('starts not closed', () => {
    const sub = new Subscribable<number>();
    const s = sub.subscribe(() => {});
    expect(s.closed).toBe(false);
  });

  it('marks closed after dispose', () => {
    const sub = new Subscribable<number>();
    const s = sub.subscribe(() => {});
    s.dispose();
    expect(s.closed).toBe(true);
  });

  it('dispose is idempotent', () => {
    const sub = new Subscribable<number>();
    const s = sub.subscribe(() => {});
    s.dispose();
    s.dispose();
    expect(s.closed).toBe(true);
    expect(sub.getSubscriptionsCount()).toBe(0);
  });

  it('does not fire callback after dispose', () => {
    const sub = new Subscribable<number>();
    const values: number[] = [];
    const s = sub.subscribe(v => values.push(v));
    s.dispose();
    sub.notifySubscribers(42);
    expect(values).toEqual([]);
  });
});

describe('Subscribable', () => {
  describe('subscribe and notify', () => {
    it('fires callback with the notified value', () => {
      const sub = new Subscribable<string>();
      const values: string[] = [];
      sub.subscribe(v => values.push(v));
      sub.notifySubscribers('hello');
      expect(values).toEqual(['hello']);
    });

    it('fires multiple subscribers', () => {
      const sub = new Subscribable<number>();
      const a: number[] = [];
      const b: number[] = [];
      sub.subscribe(v => a.push(v));
      sub.subscribe(v => b.push(v));
      sub.notifySubscribers(7);
      expect(a).toEqual([7]);
      expect(b).toEqual([7]);
    });

    it('defaults to "change" event when no event specified', () => {
      const sub = new Subscribable<number>();
      const values: number[] = [];
      sub.subscribe(v => values.push(v));
      sub.notifySubscribers(1);
      expect(values).toEqual([1]);
    });

    it('fires only subscribers for the matching event', () => {
      const sub = new Subscribable<number>();
      const changeValues: number[] = [];
      const beforeValues: number[] = [];
      sub.subscribe(v => changeValues.push(v));
      sub.subscribe(v => beforeValues.push(v), 'beforeChange');
      sub.notifySubscribers(10);
      sub.notifySubscribers(20, 'beforeChange');
      expect(changeValues).toEqual([10]);
      expect(beforeValues).toEqual([20]);
    });

    it('does nothing when notifying an event with no subscribers', () => {
      const sub = new Subscribable<number>();
      expect(() => sub.notifySubscribers(1, 'nonexistent')).not.toThrow();
    });
  });

  describe('mid-iteration disposal', () => {
    it('safely handles a subscription disposing itself during notification', () => {
      const sub = new Subscribable<number>();
      const results: string[] = [];
      let selfSub: Subscription<number>;

      sub.subscribe(() => results.push('first'));
      selfSub = sub.subscribe(() => {
        results.push('self-disposing');
        selfSub.dispose();
      });
      sub.subscribe(() => results.push('third'));

      sub.notifySubscribers(1);
      expect(results).toEqual(['first', 'self-disposing', 'third']);
      expect(sub.getSubscriptionsCount()).toBe(2);
    });

    it('safely handles disposing another subscription during notification', () => {
      const sub = new Subscribable<number>();
      const results: string[] = [];
      let victim: Subscription<number>;

      sub.subscribe(() => {
        results.push('killer');
        victim.dispose();
      });
      victim = sub.subscribe(() => results.push('victim'));
      sub.subscribe(() => results.push('survivor'));

      sub.notifySubscribers(1);
      // victim is skipped because it was disposed before its turn
      expect(results).toEqual(['killer', 'survivor']);
      expect(sub.getSubscriptionsCount()).toBe(2);
    });
  });

  describe('version tracking', () => {
    it('starts at version 1', () => {
      const sub = new Subscribable<number>();
      expect(sub.getVersion()).toBe(1);
    });

    it('updateVersion increments the version', () => {
      const sub = new Subscribable<number>();
      sub.updateVersion();
      expect(sub.getVersion()).toBe(2);
    });

    it('hasChanged returns true when version differs', () => {
      const sub = new Subscribable<number>();
      expect(sub.hasChanged(0)).toBe(true);
      expect(sub.hasChanged(1)).toBe(false);
    });

    it('notifySubscribers bumps version on "change" event', () => {
      const sub = new Subscribable<number>();
      const v1 = sub.getVersion();
      sub.notifySubscribers(1);
      expect(sub.getVersion()).toBe(v1 + 1);
    });

    it('notifySubscribers does not bump version on custom events', () => {
      const sub = new Subscribable<number>();
      const v1 = sub.getVersion();
      sub.notifySubscribers(1, 'beforeChange');
      expect(sub.getVersion()).toBe(v1);
    });
  });

  describe('hasSubscriptionsForEvent', () => {
    it('returns false when no subscriptions exist for an event', () => {
      const sub = new Subscribable<number>();
      expect(sub.hasSubscriptionsForEvent('change')).toBe(false);
      expect(sub.hasSubscriptionsForEvent('beforeChange')).toBe(false);
    });

    it('returns true when subscriptions exist', () => {
      const sub = new Subscribable<number>();
      sub.subscribe(() => {});
      expect(sub.hasSubscriptionsForEvent('change')).toBe(true);
    });

    it('returns false after all subscriptions are disposed', () => {
      const sub = new Subscribable<number>();
      const s = sub.subscribe(() => {});
      s.dispose();
      expect(sub.hasSubscriptionsForEvent('change')).toBe(false);
    });
  });

  describe('getSubscriptionsCount', () => {
    it('returns 0 for a fresh subscribable', () => {
      const sub = new Subscribable<number>();
      expect(sub.getSubscriptionsCount()).toBe(0);
    });

    it('returns count for a specific event', () => {
      const sub = new Subscribable<number>();
      sub.subscribe(() => {});
      sub.subscribe(() => {});
      sub.subscribe(() => {}, 'beforeChange');
      expect(sub.getSubscriptionsCount('change')).toBe(2);
      expect(sub.getSubscriptionsCount('beforeChange')).toBe(1);
    });

    it('returns total count across all events when no event specified', () => {
      const sub = new Subscribable<number>();
      sub.subscribe(() => {});
      sub.subscribe(() => {}, 'beforeChange');
      expect(sub.getSubscriptionsCount()).toBe(2);
    });

    it('excludes "dirty" event from the total count', () => {
      const sub = new Subscribable<number>();
      sub.subscribe(() => {});
      sub.subscribe(() => {}, 'dirty');
      expect(sub.getSubscriptionsCount()).toBe(1);
      expect(sub.getSubscriptionsCount('dirty')).toBe(1);
    });

    it('decrements after disposal', () => {
      const sub = new Subscribable<number>();
      const s1 = sub.subscribe(() => {});
      const s2 = sub.subscribe(() => {});
      expect(sub.getSubscriptionsCount()).toBe(2);
      s1.dispose();
      expect(sub.getSubscriptionsCount()).toBe(1);
      s2.dispose();
      expect(sub.getSubscriptionsCount()).toBe(0);
    });
  });

  describe('isDifferent', () => {
    it('returns true by default (no equality comparer)', () => {
      const sub = new Subscribable<number>();
      expect(sub.isDifferent(1, 1)).toBe(true);
      expect(sub.isDifferent(1, 2)).toBe(true);
    });

    it('delegates to equalityComparer when set', () => {
      const sub = new Subscribable<number>();
      sub.equalityComparer = (a, b) => a === b;
      expect(sub.isDifferent(1, 1)).toBe(false);
      expect(sub.isDifferent(1, 2)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('calls beforeSubscriptionAdd when subscribing', () => {
      const sub = new Subscribable<number>();
      const events: string[] = [];
      sub['beforeSubscriptionAdd'] = (event: string) => events.push(`before:${event}`);
      sub.subscribe(() => {});
      sub.subscribe(() => {}, 'beforeChange');
      expect(events).toEqual(['before:change', 'before:beforeChange']);
    });

    it('calls afterSubscriptionRemove when disposing', () => {
      const sub = new Subscribable<number>();
      const events: string[] = [];
      sub['afterSubscriptionRemove'] = (event: string) => events.push(`after:${event}`);
      const s1 = sub.subscribe(() => {});
      const s2 = sub.subscribe(() => {}, 'beforeChange');
      s1.dispose();
      s2.dispose();
      expect(events).toEqual(['after:change', 'after:beforeChange']);
    });
  });
});

describe('isSubscribable', () => {
  it('returns true for a Subscribable instance', () => {
    const sub = new Subscribable<number>();
    expect(isSubscribable(sub)).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isSubscribable(null)).toBe(false);
    expect(isSubscribable(undefined)).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isSubscribable({})).toBe(false);
    expect(isSubscribable({ subscribe: 'not a function' })).toBe(false);
  });

  it('returns true for duck-typed objects with subscribe and notifySubscribers', () => {
    const fake = {
      subscribe: () => {},
      notifySubscribers: () => {},
    };
    expect(isSubscribable(fake)).toBe(true);
  });

  it('returns false for primitives', () => {
    expect(isSubscribable(42)).toBe(false);
    expect(isSubscribable('hello')).toBe(false);
    expect(isSubscribable(true)).toBe(false);
  });
});
