//Splits text into chunks of at most maxLen, preferring newline, sentence, then word boundaries.
export function splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
        //Try to break at a sentence boundary or space near the limit
        let splitIndex = remaining.lastIndexOf("\n", maxLen);
        if (splitIndex === -1) splitIndex = remaining.lastIndexOf(". ", maxLen);
        if (splitIndex === -1) splitIndex = remaining.lastIndexOf(" ", maxLen);
        if (splitIndex === -1) splitIndex = maxLen - 1; //Fallback hard split: chunk is exactly maxLen characters

        const chunk = remaining.slice(0, splitIndex + 1).trim();
        parts.push(chunk);
        remaining = remaining.slice(splitIndex + 1).trim();
    }

    if (remaining.length > 0) parts.push(remaining);
    return parts;
}
