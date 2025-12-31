import { randomInt } from "@core/utils/probabilityUtils.js";

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function randomSleep(minMs: number, maxMs: number): Promise<void> {
    const delay = randomInt(minMs, maxMs);
    await sleep(delay);
}

//Takes a string like "1 s" or "2 hours" and converts it to milliseconds.
export function parseTimeSpan(input: string | null | undefined): number {
    //Return a default of 1 second (in milliseconds)
    if (!input || input.trim() === "") {
        return 1000;
    }

    const matches = input.match(/((?:\d\.)?\d+)\s*(ms?|s|secs?|seconds?|m|mins?|minutes?|h|hr|hrs?|hour|hours?)/i);
    if (!matches) {
        throw new Error("Invalid time format");
    }

    const value = parseFloat(matches[1]!);
    const unit = matches[2]!.toLowerCase();

    if (unit === "ms") return value;
    if (["s", "sec", "secs", "second", "seconds"].includes(unit)) return value * 1000;
    if (["m", "min", "mins", "minute", "minutes"].includes(unit)) return value * 60_000;
    if (["h", "hr", "hrs", "hour", "hours"].includes(unit)) return value * 3_600_000;

    throw new Error("Unsupported time unit");
}
