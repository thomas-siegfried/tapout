import {
  Event, EventSubscribable, EventSubscription, AggregateEvent,
  isEvent, isEventSubscribable, isAggregateEvent,
  cleanNode, removeNode,
} from '#src/index.js';

class SaveEvent {
  constructor(public id: number) {}
}

class DeleteEvent {
  constructor(public id: number) {}
}

class ItemChangedEvent {
  constructor(public itemId: number) {}
}

describe('EventSubscription', () => {
  it('starts not closed', () => {
    const event = new Event<number>();
    const sub = event.subscribable.subscribe(() => {});
    expect(sub.closed).toBe(false);
  });

  it('marks closed after dispose', () => {
    const event = new Event<number>();
    const sub = event.subscribable.subscribe(() => {});
    sub.dispose();
    expect(sub.closed).toBe(true);
  });

  it('dispose is idempotent', () => {
    const event = new Event<number>();
    const sub = event.subscribable.subscribe(() => {});
    sub.dispose();
    sub.dispose();
    expect(sub.closed).toBe(true);
    expect(event.subscribable.subscriberCount).toBe(0);
  });

  it('does not fire callback after dispose', () => {
    const event = new Event<number>();
    const values: number[] = [];
    const sub = event.subscribable.subscribe(v => values.push(v));
    sub.dispose();
    event.emit(42);
    expect(values).toEqual([]);
  });

  it('disposeWhenNodeIsRemoved disposes when node is cleaned', () => {
    const event = new Event<number>();
    const values: number[] = [];
    const sub = event.subscribable.subscribe(v => values.push(v));

    const node = document.createElement('div');
    sub.disposeWhenNodeIsRemoved(node);

    event.emit(1);
    expect(values).toEqual([1]);

    cleanNode(node);

    event.emit(2);
    expect(values).toEqual([1]);
    expect(sub.closed).toBe(true);
  });

  it('disposeWhenNodeIsRemoved disposes when node is removed', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    const event = new Event<string>();
    const values: string[] = [];
    const sub = event.subscribable.subscribe(v => values.push(v));
    sub.disposeWhenNodeIsRemoved(child);

    event.emit('before');
    expect(values).toEqual(['before']);

    removeNode(child);

    event.emit('after');
    expect(values).toEqual(['before']);
    expect(sub.closed).toBe(true);
  });
});

describe('Event', () => {
  it('emits values to subscribers via subscribable', () => {
    const event = new Event<number>();
    const values: number[] = [];
    event.subscribable.subscribe(v => values.push(v));

    event.emit(1);
    event.emit(2);
    expect(values).toEqual([1, 2]);
  });

  it('supports multiple subscribers', () => {
    const event = new Event<string>();
    const a: string[] = [];
    const b: string[] = [];
    event.subscribable.subscribe(v => a.push(v));
    event.subscribable.subscribe(v => b.push(v));

    event.emit('hello');
    expect(a).toEqual(['hello']);
    expect(b).toEqual(['hello']);
  });

  it('is hot: late subscribers do not get previous values', () => {
    const event = new Event<number>();
    event.emit(1);

    const values: number[] = [];
    event.subscribable.subscribe(v => values.push(v));

    event.emit(2);
    expect(values).toEqual([2]);
  });

  it('subscribable does not expose emit', () => {
    const event = new Event<number>();
    expect('emit' in event.subscribable).toBe(false);
  });

  it('throws when emitting on a disposed event', () => {
    const event = new Event<number>();
    event.dispose();
    expect(() => event.emit(1)).toThrowError('Event is disposed');
  });

  it('dispose clears all subscribers', () => {
    const event = new Event<number>();
    const values: number[] = [];
    event.subscribable.subscribe(v => values.push(v));

    event.emit(1);
    expect(values).toEqual([1]);

    event.dispose();
    expect(event.isDisposed).toBe(true);
    expect(event.subscribable.subscriberCount).toBe(0);
  });

  it('dispose is idempotent', () => {
    const event = new Event<number>();
    event.dispose();
    event.dispose();
    expect(event.isDisposed).toBe(true);
  });

  it('safely handles a subscriber disposing itself during emit', () => {
    const event = new Event<number>();
    const results: string[] = [];
    let selfSub: EventSubscription;

    event.subscribable.subscribe(() => results.push('first'));
    selfSub = event.subscribable.subscribe(() => {
      results.push('self-disposing');
      selfSub.dispose();
    });
    event.subscribable.subscribe(() => results.push('third'));

    event.emit(1);
    expect(results).toEqual(['first', 'self-disposing', 'third']);
    expect(event.subscribable.subscriberCount).toBe(2);
  });

  it('safely handles disposing another subscriber during emit', () => {
    const event = new Event<number>();
    const results: string[] = [];
    let victim: EventSubscription;

    event.subscribable.subscribe(() => {
      results.push('killer');
      victim.dispose();
    });
    victim = event.subscribable.subscribe(() => results.push('victim'));
    event.subscribable.subscribe(() => results.push('survivor'));

    event.emit(1);
    expect(results).toEqual(['killer', 'survivor']);
    expect(event.subscribable.subscriberCount).toBe(2);
  });
});

describe('EventSubscribable.on', () => {
  it('filters events by instanceof', () => {
    const event = new Event<SaveEvent | DeleteEvent>();
    const saves: SaveEvent[] = [];

    event.subscribable.on(SaveEvent).subscribe(v => saves.push(v));

    event.emit(new SaveEvent(1));
    event.emit(new DeleteEvent(2));
    event.emit(new SaveEvent(3));

    expect(saves.length).toBe(2);
    expect(saves[0].id).toBe(1);
    expect(saves[1].id).toBe(3);
  });

  it('does not fire for non-matching types', () => {
    const event = new Event<SaveEvent | DeleteEvent>();
    const deletes: DeleteEvent[] = [];

    event.subscribable.on(DeleteEvent).subscribe(v => deletes.push(v));

    event.emit(new SaveEvent(1));
    event.emit(new SaveEvent(2));

    expect(deletes.length).toBe(0);
  });

  it('disposing filtered subscription removes it from parent', () => {
    const event = new Event<SaveEvent | DeleteEvent>();
    const sub = event.subscribable.on(SaveEvent).subscribe(() => {});

    expect(event.subscribable.subscriberCount).toBe(1);
    sub.dispose();
    expect(event.subscribable.subscriberCount).toBe(0);
  });

  it('supports chained on() calls for subtype filtering', () => {
    class UrgentSaveEvent extends SaveEvent {
      constructor(id: number, public urgent: boolean) { super(id); }
    }

    const event = new Event<SaveEvent | DeleteEvent>();
    const urgent: UrgentSaveEvent[] = [];

    event.subscribable.on(UrgentSaveEvent).subscribe(v => urgent.push(v));

    event.emit(new SaveEvent(1));
    event.emit(new UrgentSaveEvent(2, true));
    event.emit(new DeleteEvent(3));
    event.emit(new UrgentSaveEvent(4, false));

    expect(urgent.length).toBe(2);
    expect(urgent[0].id).toBe(2);
    expect(urgent[1].id).toBe(4);
  });

  it('multiple on() filters can coexist independently', () => {
    const event = new Event<SaveEvent | DeleteEvent>();
    const saves: SaveEvent[] = [];
    const deletes: DeleteEvent[] = [];

    event.subscribable.on(SaveEvent).subscribe(v => saves.push(v));
    event.subscribable.on(DeleteEvent).subscribe(v => deletes.push(v));

    event.emit(new SaveEvent(1));
    event.emit(new DeleteEvent(2));
    event.emit(new SaveEvent(3));

    expect(saves.length).toBe(2);
    expect(deletes.length).toBe(1);
    expect(deletes[0].id).toBe(2);
  });
});

describe('AggregateEvent', () => {
  it('receives events from a single piped source', () => {
    const source = new Event<SaveEvent>();
    const aggregate = new AggregateEvent<SaveEvent>();
    aggregate.pipe(source.subscribable);

    const values: SaveEvent[] = [];
    aggregate.subscribable.subscribe(v => values.push(v));

    source.emit(new SaveEvent(1));
    expect(values.length).toBe(1);
    expect(values[0].id).toBe(1);
  });

  it('pipes multiple sources in one call', () => {
    const onSave = new Event<SaveEvent>();
    const onDelete = new Event<DeleteEvent>();
    const aggregate = new AggregateEvent<SaveEvent | DeleteEvent>();

    aggregate.pipe(onSave.subscribable, onDelete.subscribable);

    const values: (SaveEvent | DeleteEvent)[] = [];
    aggregate.subscribable.subscribe(v => values.push(v));

    onSave.emit(new SaveEvent(1));
    onDelete.emit(new DeleteEvent(2));
    onSave.emit(new SaveEvent(3));

    expect(values.length).toBe(3);
  });

  it('supports multiple pipe calls to add sources later', () => {
    const onSave = new Event<SaveEvent>();
    const onDelete = new Event<DeleteEvent>();
    const aggregate = new AggregateEvent<SaveEvent | DeleteEvent>();

    aggregate.pipe(onSave.subscribable);

    const values: (SaveEvent | DeleteEvent)[] = [];
    aggregate.subscribable.subscribe(v => values.push(v));

    onSave.emit(new SaveEvent(1));
    expect(values.length).toBe(1);

    aggregate.pipe(onDelete.subscribable);

    onDelete.emit(new DeleteEvent(2));
    expect(values.length).toBe(2);
  });

  it('dispose cleans up piped subscriptions', () => {
    const source = new Event<SaveEvent>();
    const aggregate = new AggregateEvent<SaveEvent>();
    const [sub] = aggregate.pipe(source.subscribable);

    expect(sub.closed).toBe(false);
    aggregate.dispose();
    expect(sub.closed).toBe(true);
    expect(aggregate.isDisposed).toBe(true);
  });

  it('on(Type) filters events from all piped sources', () => {
    const onSave = new Event<SaveEvent>();
    const onDelete = new Event<DeleteEvent>();
    const aggregate = new AggregateEvent<SaveEvent | DeleteEvent>();
    aggregate.pipe(onSave.subscribable, onDelete.subscribable);

    const saves: SaveEvent[] = [];
    aggregate.subscribable.on(SaveEvent).subscribe(v => saves.push(v));

    onSave.emit(new SaveEvent(1));
    onDelete.emit(new DeleteEvent(2));
    onSave.emit(new SaveEvent(3));

    expect(saves.length).toBe(2);
    expect(saves[0].id).toBe(1);
    expect(saves[1].id).toBe(3);
  });

  it('supports tree roll-up: aggregate of aggregates', () => {
    const onChange = new Event<ItemChangedEvent>();
    const grandChildEvents = new AggregateEvent<ItemChangedEvent>();
    grandChildEvents.pipe(onChange.subscribable);

    const onSave = new Event<SaveEvent>();
    const onDelete = new Event<DeleteEvent>();
    const childEvents = new AggregateEvent<SaveEvent | DeleteEvent | ItemChangedEvent>();
    childEvents.pipe(onSave.subscribable, onDelete.subscribable, grandChildEvents.subscribable);

    const all: (SaveEvent | DeleteEvent | ItemChangedEvent)[] = [];
    childEvents.subscribable.subscribe(v => all.push(v));

    const saves: SaveEvent[] = [];
    childEvents.subscribable.on(SaveEvent).subscribe(v => saves.push(v));

    onSave.emit(new SaveEvent(1));
    onDelete.emit(new DeleteEvent(2));
    onChange.emit(new ItemChangedEvent(3));

    expect(all.length).toBe(3);
    expect(saves.length).toBe(1);
    expect(saves[0].id).toBe(1);
  });

  it('pipe returns subscriptions that can be individually disposed', () => {
    const onSave = new Event<SaveEvent>();
    const onDelete = new Event<DeleteEvent>();
    const aggregate = new AggregateEvent<SaveEvent | DeleteEvent>();
    const [saveSub] = aggregate.pipe(onSave.subscribable, onDelete.subscribable);

    const values: (SaveEvent | DeleteEvent)[] = [];
    aggregate.subscribable.subscribe(v => values.push(v));

    onSave.emit(new SaveEvent(1));
    onDelete.emit(new DeleteEvent(2));
    expect(values.length).toBe(2);

    saveSub.dispose();

    onSave.emit(new SaveEvent(3));
    onDelete.emit(new DeleteEvent(4));
    expect(values.length).toBe(3);
  });
});

describe('type guards', () => {
  it('isEvent returns true for Event and AggregateEvent', () => {
    expect(isEvent(new Event())).toBe(true);
    expect(isEvent(new AggregateEvent())).toBe(true);
    expect(isEvent({})).toBe(false);
    expect(isEvent(null)).toBe(false);
  });

  it('isEventSubscribable returns true for EventSubscribable', () => {
    const event = new Event();
    expect(isEventSubscribable(event.subscribable)).toBe(true);
    expect(isEventSubscribable({})).toBe(false);
    expect(isEventSubscribable(null)).toBe(false);
  });

  it('isAggregateEvent distinguishes aggregate from plain event', () => {
    expect(isAggregateEvent(new AggregateEvent())).toBe(true);
    expect(isAggregateEvent(new Event())).toBe(false);
    expect(isAggregateEvent({})).toBe(false);
  });
});
