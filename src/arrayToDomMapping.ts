import { Observable } from './observable.js';
import { Computed } from './computed.js';
import { ignore } from './dependencyDetection.js';
import { domDataGet, domDataSet, domDataNextKey } from './domData.js';
import { addDisposeCallback, cleanNode, removeNode } from './domNodeDisposal.js';
import { compareArrays } from './compareArrays.js';
import type { ArrayChange } from './compareArrays.js';
import { virtualInsertAfter } from './virtualElements.js';
import {
  fixUpContinuousNodeArray,
  replaceDomNodes,
  anyDomNodeIsAttachedToDocument,
} from './utils.js';

interface MappingResult<T> {
  arrayEntry: T;
  indexObservable: Observable<number>;
  mappedNodes?: Node[];
  dependentObservable?: Computed<void>;
  initialized?: boolean;
  _countWaitingForRemove?: number;
}

export interface ArrayMappingOptions {
  dontLimitMoves?: boolean;
  beforeRemove?: (node: Node, index: number, item: unknown) => void;
  afterAdd?: (node: Node, index: number, item: unknown) => void;
  beforeMove?: (node: Node, index: number, item: unknown) => void;
  afterMove?: (node: Node, index: number, item: unknown) => void;
}

type MappingFunction<T> = (
  value: T,
  index: Observable<number>,
  existingNodes: Node[],
) => Node[];

type CallbackAfterAddingNodes<T> = (
  value: T,
  addedNodes: Node[],
  index: Observable<number>,
) => void;

const lastMappingResultDomDataKey = domDataNextKey();
const deletedItemDummyValue = domDataNextKey();

function mapNodeAndRefreshWhenChanged<T>(
  containerNode: Node,
  mapping: MappingFunction<T>,
  valueToMap: T,
  callbackAfterAddingNodes: CallbackAfterAddingNodes<T> | undefined,
  index: Observable<number>,
): Pick<MappingResult<T>, 'mappedNodes' | 'dependentObservable'> {
  let mappedNodes: Node[] = [];
  const dependentObservable = new Computed<void>(() => {
    const newMappedNodes = mapping(valueToMap, index, fixUpContinuousNodeArray(mappedNodes, containerNode)) || [];

    if (mappedNodes.length > 0) {
      replaceDomNodes(mappedNodes, newMappedNodes);
      if (callbackAfterAddingNodes) {
        ignore(() => callbackAfterAddingNodes(valueToMap, newMappedNodes, index));
      }
    }

    mappedNodes.length = 0;
    mappedNodes.push(...newMappedNodes);
  });

  addDisposeCallback(containerNode, () => dependentObservable.dispose());

  const disposeWhenDetached = () => {
    if (!anyDomNodeIsAttachedToDocument(mappedNodes)) {
      dependentObservable.dispose();
    }
  };
  if (mappedNodes.length > 0) {
    addDisposeCallback(mappedNodes[0], disposeWhenDetached);
  }

  return {
    mappedNodes,
    dependentObservable: dependentObservable.isActive() ? dependentObservable : undefined,
  };
}

function callCallback<T>(
  callback: ((node: Node, index: number, item: T) => void) | undefined,
  items: (MappingResult<T> | undefined)[],
): void {
  if (callback) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item) {
        const nodes = item.mappedNodes!;
        for (let j = 0; j < nodes.length; j++) {
          callback(nodes[j], i, item.arrayEntry);
        }
      }
    }
  }
}

export function setDomNodeChildrenFromArrayMapping<T>(
  domNode: Node,
  array: T[],
  mapping: MappingFunction<T>,
  options: ArrayMappingOptions | undefined,
  callbackAfterAddingNodes: CallbackAfterAddingNodes<T> | undefined,
  editScript?: ArrayChange<T>[],
): void {
  array = array || ([] as T[]);
  options = options || {};

  const lastMappingResult = domDataGet(domNode, lastMappingResultDomDataKey) as MappingResult<T>[] | undefined;
  const isFirstExecution = !lastMappingResult;

  const newMappingResult: MappingResult<T>[] = [];
  let lastMappingResultIndex = 0;
  let currentArrayIndex = 0;

  const nodesToDelete: Node[] = [];
  const itemsToMoveFirstIndexes: number[] = [];
  const itemsForBeforeRemoveCallbacks: (MappingResult<T> | undefined)[] = [];
  const itemsForBeforeMoveCallbacks: (MappingResult<T> | undefined)[] = [];
  const itemsForAfterMoveCallbacks: (MappingResult<T> | undefined)[] = [];
  const itemsForAfterAddCallbacks: (MappingResult<T> | undefined)[] = [];
  let mapData: MappingResult<T>;
  let countWaitingForRemove = 0;

  function itemAdded(value: T): void {
    mapData = { arrayEntry: value, indexObservable: new Observable(currentArrayIndex++) };
    newMappingResult.push(mapData);
    if (!isFirstExecution) {
      itemsForAfterAddCallbacks[currentArrayIndex - 1] = mapData;
    }
  }

  function itemMovedOrRetained(oldPosition: number): void {
    mapData = lastMappingResult![oldPosition];
    if (currentArrayIndex !== mapData.indexObservable.peek()) {
      itemsForBeforeMoveCallbacks[mapData.indexObservable.peek() as number] = mapData;
      itemsForAfterMoveCallbacks[currentArrayIndex] = mapData;
    }
    mapData.indexObservable.set(currentArrayIndex++);
    fixUpContinuousNodeArray(mapData.mappedNodes!, domNode);
    newMappingResult.push(mapData);
  }

  if (isFirstExecution) {
    for (let i = 0; i < array.length; i++) itemAdded(array[i]);
  } else {
    if (!editScript || (lastMappingResult as MappingResult<T>[] & { _countWaitingForRemove?: number })._countWaitingForRemove) {
      const lastArray = lastMappingResult!.map(x => x.arrayEntry);
      const compareOptions = {
        dontLimitMoves: options.dontLimitMoves,
        sparse: true,
      };
      editScript = compareArrays(lastArray, array, compareOptions);
    }

    for (let i = 0; i < editScript.length; i++) {
      const editScriptItem = editScript[i];
      const movedIndex = editScriptItem.moved;
      const itemIndex = editScriptItem.index;

      switch (editScriptItem.status) {
        case 'deleted':
          while (lastMappingResultIndex < itemIndex) {
            itemMovedOrRetained(lastMappingResultIndex++);
          }
          if (movedIndex === undefined) {
            mapData = lastMappingResult![lastMappingResultIndex];

            if (mapData.dependentObservable) {
              mapData.dependentObservable.dispose();
              mapData.dependentObservable = undefined;
            }

            if (fixUpContinuousNodeArray(mapData.mappedNodes!, domNode).length) {
              if (options.beforeRemove) {
                newMappingResult.push(mapData);
                countWaitingForRemove++;
                if (mapData.arrayEntry === deletedItemDummyValue as unknown) {
                  mapData = null!;
                } else {
                  itemsForBeforeRemoveCallbacks[mapData.indexObservable.peek() as number] = mapData;
                }
              }
              if (mapData) {
                nodesToDelete.push(...mapData.mappedNodes!);
              }
            }
          }
          lastMappingResultIndex++;
          break;

        case 'added':
          while (currentArrayIndex < itemIndex) {
            itemMovedOrRetained(lastMappingResultIndex++);
          }
          if (movedIndex !== undefined) {
            itemsToMoveFirstIndexes.push(newMappingResult.length);
            itemMovedOrRetained(movedIndex);
          } else {
            itemAdded(editScriptItem.value);
          }
          break;
      }
    }

    while (currentArrayIndex < array.length) {
      itemMovedOrRetained(lastMappingResultIndex++);
    }

    (newMappingResult as MappingResult<T>[] & { _countWaitingForRemove?: number })._countWaitingForRemove = countWaitingForRemove;
  }

  domDataSet(domNode, lastMappingResultDomDataKey, newMappingResult);

  callCallback(options.beforeMove, itemsForBeforeMoveCallbacks);

  for (const node of nodesToDelete) {
    if (options.beforeRemove) {
      cleanNode(node);
    } else {
      removeNode(node);
    }
  }

  let lastNode: Node | undefined;
  let activeElement: Element | null = null;

  try {
    activeElement = domNode.ownerDocument!.activeElement;
  } catch (_e) { /* ignore */ }

  // Process moves first to reduce overall DOM operations
  if (itemsToMoveFirstIndexes.length) {
    const indexes = itemsToMoveFirstIndexes.slice();
    let idx: number | undefined;
    while ((idx = indexes.shift()) !== undefined) {
      mapData = newMappingResult[idx];
      lastNode = undefined;
      for (let scanIdx = idx; scanIdx > 0;) {
        const mappedNodes = newMappingResult[--scanIdx].mappedNodes;
        if (mappedNodes && mappedNodes.length) {
          lastNode = mappedNodes[mappedNodes.length - 1];
          break;
        }
      }
      for (let j = 0; j < mapData.mappedNodes!.length; j++) {
        const nodeToInsert = mapData.mappedNodes![j];
        virtualInsertAfter(domNode, nodeToInsert, lastNode || null);
        lastNode = nodeToInsert;
      }
    }
  }

  // Add/reorder remaining items
  for (let i = 0; i < newMappingResult.length; i++) {
    mapData = newMappingResult[i];

    if (!mapData.mappedNodes) {
      const result = mapNodeAndRefreshWhenChanged(
        domNode, mapping, mapData.arrayEntry, callbackAfterAddingNodes, mapData.indexObservable,
      );
      mapData.mappedNodes = result.mappedNodes;
      mapData.dependentObservable = result.dependentObservable;
    }

    for (let j = 0; j < mapData.mappedNodes!.length; j++) {
      const nodeToInsert = mapData.mappedNodes![j];
      virtualInsertAfter(domNode, nodeToInsert, lastNode || null);
      lastNode = nodeToInsert;
    }

    if (!mapData.initialized && callbackAfterAddingNodes) {
      callbackAfterAddingNodes(mapData.arrayEntry, mapData.mappedNodes!, mapData.indexObservable);
      mapData.initialized = true;
      lastNode = mapData.mappedNodes![mapData.mappedNodes!.length - 1];
    }
  }

  // Restore focus
  if (activeElement && domNode.ownerDocument!.activeElement !== activeElement) {
    (activeElement as HTMLElement).focus?.();
  }

  callCallback(options.beforeRemove, itemsForBeforeRemoveCallbacks);

  // Mark removed items so they won't match in future diffs
  for (let i = 0; i < itemsForBeforeRemoveCallbacks.length; i++) {
    if (itemsForBeforeRemoveCallbacks[i]) {
      itemsForBeforeRemoveCallbacks[i]!.arrayEntry = deletedItemDummyValue as unknown as T;
    }
  }

  callCallback(options.afterMove, itemsForAfterMoveCallbacks);
  callCallback(options.afterAdd, itemsForAfterAddCallbacks);
}
