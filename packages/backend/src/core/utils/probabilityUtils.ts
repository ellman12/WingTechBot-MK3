export function oneIn(chance: number): boolean {
    return Math.floor(Math.random() * chance) === 0;
}
