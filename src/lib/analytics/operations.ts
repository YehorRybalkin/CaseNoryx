import { type Maybe, isNum, safeDivide } from "./numbers";

/** Capacity utilisation = actual output / theoretical capacity. */
export const capacityUtilization = (output: Maybe, capacity: Maybe) => safeDivide(output, capacity);
export const defectRate = (defects: Maybe, produced: Maybe) => safeDivide(defects, produced);

/** Production yield = good units / units started. */
export function productionYield(good: Maybe, produced: Maybe): number | null {
  return safeDivide(good, produced);
}

export const costPerGoodUnit = (totalCost: Maybe, goodUnits: Maybe) => safeDivide(totalCost, goodUnits);
export const onTimeDelivery = (onTimeUnits: Maybe, shippedUnits: Maybe) => safeDivide(onTimeUnits, shippedUnits);

/** Availability = run time / planned production time. */
export function availability(availableHours: Maybe, downtimeHours: Maybe): number | null {
  if (!isNum(availableHours) || !isNum(downtimeHours)) return null;
  return safeDivide(availableHours - downtimeHours, availableHours);
}

/** Throughput of a serial line is bounded by its slowest stage. */
export function serialThroughput(stageOutputs: Maybe[]): number | null {
  const nums = stageOutputs.filter(isNum);
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

/** Index of the bottleneck stage (lowest effective output). */
export function bottleneckIndex(stageOutputs: Maybe[]): number | null {
  let idx: number | null = null;
  let min = Infinity;
  stageOutputs.forEach((v, i) => {
    if (isNum(v) && v < min) {
      min = v;
      idx = i;
    }
  });
  return idx;
}
