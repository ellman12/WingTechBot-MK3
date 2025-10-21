export const formatEmoji = (name: string, discordId: string) => (discordId === "" ? `${name}` : `<:${name}:${discordId}>`);
