import { distance } from "fastest-levenshtein";

export function getItemsWithinDistance<T>(items: T[], needle: string, getField: (item: T) => string, maxDistance: number): (T & { distance: number })[] {
    return items
        .map(item => ({ ...item, distance: distance(needle, getField(item)) }))
        .filter(item => item.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance);
}
