import { type Subscribable, isSubscribable } from './subscribable.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance: detection is type-agnostic
type AnySubscribable = Subscribable<any>;

export interface TrackingFrame {
  callback: (subscribable: AnySubscribable, id: number) => void;
  computed?: {
    getDependenciesCount(): number;
    getDependencies(): AnySubscribable[];
  };
  isInitial?: boolean;
}

let lastId = 0;
const outerFrames: Array<TrackingFrame | undefined> = [];
let currentFrame: TrackingFrame | undefined;

export function getId(): number {
  return ++lastId;
}

export function begin(frame?: TrackingFrame): void {
  outerFrames.push(currentFrame);
  currentFrame = frame;
}

export function end(): void {
  currentFrame = outerFrames.pop();
}

export function registerDependency(subscribable: AnySubscribable): void {
  if (currentFrame) {
    if (!isSubscribable(subscribable)) {
      throw new Error('Only subscribable things can act as dependencies');
    }
    currentFrame.callback(
      subscribable,
      subscribable._id || (subscribable._id = getId()),
    );
  }
}

export function ignore<R>(callback: () => R): R {
  try {
    begin();
    return callback();
  } finally {
    end();
  }
}

export function getDependenciesCount(): number | undefined {
  if (currentFrame?.computed) {
    return currentFrame.computed.getDependenciesCount();
  }
  return undefined;
}

export function getDependencies(): AnySubscribable[] | undefined {
  if (currentFrame?.computed) {
    return currentFrame.computed.getDependencies();
  }
  return undefined;
}

export function isInitial(): boolean | undefined {
  if (currentFrame) {
    return currentFrame.isInitial;
  }
  return undefined;
}

export function getCurrentComputed(): TrackingFrame['computed'] | undefined {
  return currentFrame?.computed;
}
