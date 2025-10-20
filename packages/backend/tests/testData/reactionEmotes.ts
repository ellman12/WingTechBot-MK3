export type TestReactionEmote = [string, string];

export const validEmotes: TestReactionEmote[] = [
    ["upvote", "123456"],
    [":eyes:", ""],
    ["👀", ""],
];

export const invalidEmotes: TestReactionEmote[] = [
    ["", ""],
    ["", "374897328"],
    ["::", "123"],
    ["::", ""],
];
