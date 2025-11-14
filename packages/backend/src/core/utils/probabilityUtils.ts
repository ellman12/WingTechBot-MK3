export function oneIn(chance: number): boolean {
    return Math.floor(Math.random() * chance) === 0;
}

export function randomArrayItem<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}
