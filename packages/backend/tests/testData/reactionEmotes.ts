export type ReactionEmote = [string, string | null];

export const validEmotes: ReactionEmote[] = [
    ["upvote", "123456"],
    [":eyes:", null],
    ["👀", null],
];

export const invalidEmotes: ReactionEmote[] = [
    ["jdfhjkadsfhjkdsaf", ""],
    ["", null],
    ["", "374897328"],
    ["::", "123"],
    ["::", null],
];
