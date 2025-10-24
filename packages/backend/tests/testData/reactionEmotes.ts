export type TestReactionEmote = [string, string];

export const validEmotes: TestReactionEmote[] = [
    ["upvote", "123456"],
    [":downvote:", "456789"],
    ["👀", ""],
    ["🐈‍⬛", ""],
    ["silver", "69420"],
    ["gold", "789"],
];

export const invalidEmotes: TestReactionEmote[] = [
    ["", ""],
    ["", "374897328"],
    ["::", "123"],
    ["::", ""],
];
