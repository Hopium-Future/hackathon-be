export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomInArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function round(value: number, precision: number) {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

export function generateHash() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export const pick = <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result: any = {};
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
};

export const floor = (value: number, precision: number) => {
  const multiplier = Math.pow(10, precision || 0);
  return Math.floor(value * multiplier) / multiplier;
};

export function truncateName(name: string, maxLength: number = 10): string {
  if (!name) return '';

  if (name.length <= maxLength) {
    return name;
  }

  return name.substring(0, maxLength - 3) + '...';
}

export function formatVolume(volume: number): string {
  if (!volume || isNaN(volume)) return '0';

  const absVolume = Math.abs(volume);
  if (absVolume >= 1000000) {
    const formatted = (absVolume / 1000000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M`;
  }
  if (absVolume >= 1000) {
    const formatted = (absVolume / 1000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}K`;
  }
  return absVolume.toFixed(1).endsWith('.0')
    ? Math.round(absVolume).toString()
    : absVolume.toFixed(1);
}
