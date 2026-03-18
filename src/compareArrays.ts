export interface ArrayChange<T> {
  status: 'added' | 'deleted' | 'retained';
  value: T;
  index: number;
  moved?: number;
}

export interface CompareArraysOptions {
  sparse?: boolean;
  dontLimitMoves?: boolean;
}

export function findMovesInArrayComparison<T>(
  left: ArrayChange<T>[],
  right: ArrayChange<T>[],
  limitFailedCompares?: number | false,
): void {
  if (left.length && right.length) {
    let failedCompares: number;
    let l: number;
    let r: number;
    let leftItem: ArrayChange<T>;
    let rightItem: ArrayChange<T>;
    for (failedCompares = l = 0; (!limitFailedCompares || failedCompares < limitFailedCompares) && (leftItem = left[l]); ++l) {
      for (r = 0; (rightItem = right[r]); ++r) {
        if (leftItem.value === rightItem.value) {
          leftItem.moved = rightItem.index;
          rightItem.moved = leftItem.index;
          right.splice(r, 1);
          failedCompares = r = 0;
          break;
        }
      }
      failedCompares += r;
    }
  }
}

function compareSmallArrayToBigArray<T>(
  smlArray: T[],
  bigArray: T[],
  statusNotInSml: 'added' | 'deleted',
  statusNotInBig: 'added' | 'deleted',
  options: CompareArraysOptions,
): ArrayChange<T>[] {
  const myMin = Math.min;
  const myMax = Math.max;
  const editDistanceMatrix: number[][] = [];
  const smlIndexMax = smlArray.length;
  const bigIndexMax = bigArray.length;
  const compareRange = (bigIndexMax - smlIndexMax) || 1;
  const maxDistance = smlIndexMax + bigIndexMax + 1;
  let thisRow!: number[];
  let lastRow: number[];

  for (let smlIndex = 0; smlIndex <= smlIndexMax; smlIndex++) {
    lastRow = thisRow;
    editDistanceMatrix.push(thisRow = []);
    const bigIndexMaxForRow = myMin(bigIndexMax, smlIndex + compareRange);
    const bigIndexMinForRow = myMax(0, smlIndex - 1);
    for (let bigIndex = bigIndexMinForRow; bigIndex <= bigIndexMaxForRow; bigIndex++) {
      if (!bigIndex)
        thisRow[bigIndex] = smlIndex + 1;
      else if (!smlIndex)
        thisRow[bigIndex] = bigIndex + 1;
      else if (smlArray[smlIndex - 1] === bigArray[bigIndex - 1])
        thisRow[bigIndex] = lastRow![bigIndex - 1];
      else {
        const northDistance = lastRow![bigIndex] || maxDistance;
        const westDistance = thisRow[bigIndex - 1] || maxDistance;
        thisRow[bigIndex] = myMin(northDistance, westDistance) + 1;
      }
    }
  }

  const editScript: ArrayChange<T>[] = [];
  const notInSml: ArrayChange<T>[] = [];
  const notInBig: ArrayChange<T>[] = [];
  let smlIndex = smlIndexMax;
  let bigIndex = bigIndexMax;

  while (smlIndex || bigIndex) {
    const meMinusOne = editDistanceMatrix[smlIndex][bigIndex] - 1;
    if (bigIndex && meMinusOne === editDistanceMatrix[smlIndex][bigIndex - 1]) {
      --bigIndex;
      const entry: ArrayChange<T> = { status: statusNotInSml, value: bigArray[bigIndex], index: bigIndex };
      notInSml.push(entry);
      editScript.push(entry);
    } else if (smlIndex && meMinusOne === editDistanceMatrix[smlIndex - 1][bigIndex]) {
      --smlIndex;
      const entry: ArrayChange<T> = { status: statusNotInBig, value: smlArray[smlIndex], index: smlIndex };
      notInBig.push(entry);
      editScript.push(entry);
    } else {
      --bigIndex;
      --smlIndex;
      if (!options.sparse) {
        editScript.push({ status: 'retained', value: bigArray[bigIndex], index: bigIndex });
      }
    }
  }

  const moveLimit = !options.dontLimitMoves && smlIndexMax * 10;
  findMovesInArrayComparison(notInBig, notInSml, moveLimit);

  return editScript.reverse();
}

export function compareArrays<T>(
  oldArray: T[],
  newArray: T[],
  options?: CompareArraysOptions,
): ArrayChange<T>[] {
  const opts: CompareArraysOptions = options || {};
  const old = oldArray || [];
  const cur = newArray || [];

  if (old.length < cur.length)
    return compareSmallArrayToBigArray(old, cur, 'added', 'deleted', opts);
  else
    return compareSmallArrayToBigArray(cur, old, 'deleted', 'added', opts);
}
