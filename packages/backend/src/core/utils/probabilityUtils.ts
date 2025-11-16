//Random integer in a range (inclusive of min, exclusive of max)
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

export function oneIn(chance: number): boolean {
    return Math.floor(Math.random() * chance) === 0;
}

export function randomArrayItem<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}
