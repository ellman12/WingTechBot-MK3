export type TestReactionEmote = [string, string | null];

export const validEmotes: TestReactionEmote[] = [
    ["upvote", "123456"],
    [":eyes:", null],
    ["👀", null],
];

export const invalidEmotes: TestReactionEmote[] = [
    ["jdfhjkadsfhjkdsaf", ""],
    ["", null],
    ["", "374897328"],
    ["::", "123"],
    ["::", null],
];
