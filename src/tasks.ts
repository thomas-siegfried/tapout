import { options } from './options.js';

type TaskCallback = () => void;

let taskQueue: (TaskCallback | null)[] = [];
let taskQueueLength = 0;
let nextHandle = 1;
let nextIndexToProcess = 0;

export let scheduler: (callback: TaskCallback) => void =
  typeof queueMicrotask === 'function'
    ? (cb) => queueMicrotask(cb)
    : (cb) => setTimeout(cb, 0);

function deferError(error: unknown): void {
  if (options.onError) {
    options.onError(error);
  } else {
    setTimeout(() => { throw error; }, 0);
  }
}

function processTasks(): void {
  if (taskQueueLength) {
    let mark = taskQueueLength;
    let countMarks = 0;

    for (let task: TaskCallback | null; nextIndexToProcess < taskQueueLength; ) {
      task = taskQueue[nextIndexToProcess++];
      if (task) {
        if (nextIndexToProcess > mark) {
          if (++countMarks >= 5000) {
            nextIndexToProcess = taskQueueLength;
            deferError(new Error("'Too much recursion' after processing " + countMarks + " task groups."));
            break;
          }
          mark = taskQueueLength;
        }
        try {
          task();
        } catch (ex) {
          deferError(ex);
        }
      }
    }
  }
}

function scheduledProcess(): void {
  processTasks();
  nextIndexToProcess = taskQueueLength = taskQueue.length = 0;
}

function scheduleTaskProcessing(): void {
  scheduler(scheduledProcess);
}

export function schedule(func: TaskCallback): number {
  if (!taskQueueLength) {
    scheduleTaskProcessing();
  }
  taskQueue[taskQueueLength++] = func;
  return nextHandle++;
}

export function cancel(handle: number): void {
  const index = handle - (nextHandle - taskQueueLength);
  if (index >= nextIndexToProcess && index < taskQueueLength) {
    taskQueue[index] = null;
  }
}

export function resetForTesting(): number {
  const length = taskQueueLength - nextIndexToProcess;
  nextIndexToProcess = taskQueueLength = taskQueue.length = 0;
  return length;
}

export const runEarly: () => void = processTasks;
