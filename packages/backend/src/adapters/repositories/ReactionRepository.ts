import type { CreateReactionData, DeleteReactionData, FindReactionData, Reaction } from "@core/entities/Reaction.js";
import { karmaEmoteNames } from "@core/repositories/ReactionEmoteRepository.js";
import type { EmoteTotals, KarmaLeaderboardEntry, ReactionRepository, TopMessage } from "@core/repositories/ReactionRepository.js";
import type { DB, Reactions } from "@db/types.js";
import { type Kysely, type Selectable, sql } from "kysely";

type UnformattedReactionQueryResult = { name: string; discordId: string; count: string | number | bigint; totalKarma: string | number | bigint };

//Transform database reaction emote to domain reaction emote
export const transformReaction = (dbReaction: Selectable<Reactions> | Reactions): Reaction => {
    return {
        giverId: dbReaction.giver_id,
        receiverId: dbReaction.receiver_id,
        channelId: dbReaction.channel_id,
        messageId: dbReaction.message_id,
        emoteId: dbReaction.emote_id,
    };
};

//Factory function to create ReactionRepository instance
export const createReactionRepository = (db: Kysely<DB>): ReactionRepository => {
    const reactions = db.selectFrom("reactions").selectAll();

    const findReaction = async (data: FindReactionData): Promise<Reaction | null> => {
        const { giverId, receiverId, channelId, messageId, emoteId } = data;
        const reaction = await reactions.where("giver_id", "=", giverId).where("receiver_id", "=", receiverId).where("channel_id", "=", channelId).where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();
        return reaction ? transformReaction(reaction) : null;
    };

    const findReactionsForMessage = async (messageId: string): Promise<Reaction[]> => {
        const result = await reactions.where("message_id", "=", messageId).execute();
        return result.map(transformReaction);
    };

    const createReaction = async (data: CreateReactionData): Promise<Reaction> => {
        const ids = [data.giverId, data.receiverId, data.channelId, data.messageId];
        if (ids.some(i => !i || i === "0")) {
            throw new Error("Invalid id");
        }

        const existing = await findReaction(data);
        if (existing) {
            // Reaction already exists, return it instead of attempting duplicate insert
            return existing;
        }

        const { giverId, receiverId, channelId, messageId, emoteId } = data;
        const [reaction] = await db.insertInto("reactions").values({ giver_id: giverId, receiver_id: receiverId, channel_id: channelId, message_id: messageId, emote_id: emoteId }).returningAll().execute();

        if (!reaction) {
            throw new Error("Failed to create reaction");
        }

        return transformReaction(reaction);
    };

    const deleteReaction = async (data: DeleteReactionData): Promise<void> => {
        const { giverId, receiverId, channelId, messageId, emoteId } = data;

        const result = await db.deleteFrom("reactions").where("giver_id", "=", giverId).where("receiver_id", "=", receiverId).where("channel_id", "=", channelId).where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();

        if (result.numDeletedRows <= 0) {
            throw new Error("Failed to delete reaction, or it doesn't exist");
        }
    };

    const deleteReactionsForMessage = async (messageId: string): Promise<void> => {
        if (messageId === "" || messageId === "0") {
            throw new Error("Invalid message id");
        }

        const result = await db.deleteFrom("reactions").where("message_id", "=", messageId).executeTakeFirst();
        if (result.numDeletedRows <= 0) {
            throw new Error(`No messages with id ${messageId} to remove reactions from`);
        }
    };

    const deleteReactionsForEmote = async (messageId: string, emoteId: number): Promise<void> => {
        if (messageId === "" || emoteId === 0) {
            throw new Error("Invalid id");
        }

        const result = await db.deleteFrom("reactions").where("message_id", "=", messageId).where("emote_id", "=", emoteId).executeTakeFirst();
        if (result.numDeletedRows <= 0) {
            throw new Error(`No messages with id ${messageId} to remove reactions from`);
        }
    };

    const getBaseQuery = (year?: number) =>
        db
            .selectFrom("messages as m")
            .innerJoin("reactions as r", "r.message_id", "m.id")
            .innerJoin("reaction_emotes as re", "r.emote_id", "re.id")
            .select(eb => [eb.fn.countAll().as("count"), eb.fn.sum("re.karma_value").as("totalKarma")])
            .$if(year !== undefined, qb => qb.where(sql`extract(year from ${sql.ref("m.created_at")})`, "=", year));

    const getBaseReactionsQuery = (year?: number) => getBaseQuery(year).select(["re.name", "re.discord_id as discordId"]).groupBy(["re.name", "discordId"]).orderBy("count", "desc");

    //Ensures the count results are numbers and not strings or bigints.
    const formatReactionQueryResult = (emote: UnformattedReactionQueryResult) => ({ ...emote, count: Number(emote.count), totalKarma: Number(emote.totalKarma) });

    //Calculates a user's karma and awards, optionally for a year. Ignores self-reactions.
    const getKarmaAndAwards = async (receiverId: string, year?: number): Promise<EmoteTotals> => {
        const query = getBaseReactionsQuery(year).where("r.receiver_id", "=", receiverId).where("r.giver_id", "!=", receiverId).where("re.name", "in", karmaEmoteNames);
        const emotes = (await query.execute()).map(formatReactionQueryResult);

        //Fills in missing karma emotes with 0 values if not already present.
        return karmaEmoteNames.map(name => ({
            name,
            discordId: emotes.find(r => r.name === name)?.discordId ?? "",
            count: emotes.find(r => r.name === name)?.count ?? 0,
            totalKarma: emotes.find(r => r.name === name)?.totalKarma ?? 0,
        }));
    };

    //Get all the reactions this user has received, optionally filtering by year and/or specific givers. Ignores self-reactions (unless it's in giverIds).
    const getReactionsReceived = async (receiverId: string, year?: number, giverIds?: string[]): Promise<EmoteTotals> => {
        const query = getBaseReactionsQuery(year)
            .where("r.receiver_id", "=", receiverId)
            .$if(giverIds !== undefined && giverIds.length > 0, qb => qb.where("r.giver_id", "in", giverIds!)) //Filter by giverIds if present. This can include receiverId.
            .$if(giverIds === undefined || giverIds.length === 0, qb => qb.where("r.giver_id", "!=", receiverId)); //Get reactions from all users except receiverId.

        return (await query.execute()).map(formatReactionQueryResult);
    };

    //Gets all the reactions this user has given, optionally filtering by year and/or specific receivers. Ignores self-reactions (unless it's the only receiverId specified).
    const getReactionsGiven = async (giverId: string, year?: number, receiverIds?: string[]): Promise<EmoteTotals> => {
        const query = getBaseReactionsQuery(year)
            .where("r.giver_id", "=", giverId)
            .$if(receiverIds !== undefined && receiverIds.length > 0, qb => qb.where("r.receiver_id", "in", receiverIds!)) //Filter by receiverIds if present. This can include giverId.
            .$if(receiverIds === undefined || receiverIds.length === 0, qb => qb.where("r.receiver_id", "!=", giverId)); //Get reactions from all users except receiverId.

        return (await query.execute()).map(formatReactionQueryResult);
    };

    //Calculates which emotes have been used the most in reactions.
    const getEmoteLeaderboard = async (year?: number, includeSelfReactions?: boolean, limit = 15): Promise<EmoteTotals> => {
        const query = getBaseReactionsQuery(year)
            .$if(!includeSelfReactions, qb => qb.whereRef("r.giver_id", "!=", "r.receiver_id"))
            .$if(limit !== undefined, qb => qb.limit(limit));

        return (await query.execute()).map(formatReactionQueryResult);
    };

    //Gets the leaderboard for karma, optionally for a year.
    const getKarmaLeaderboard = async (year?: number, includeSelfReactions?: boolean): Promise<KarmaLeaderboardEntry[]> => {
        const query = getBaseQuery(year)
            .select(["r.receiver_id as userId"])
            .$if(!includeSelfReactions, qb => qb.whereRef("r.giver_id", "!=", "r.receiver_id"))
            .groupBy("r.receiver_id")
            .orderBy("totalKarma", "desc");

        return (await query.execute()).map(k => ({ ...k, count: Number(k.count), totalKarma: Number(k.totalKarma) }));
    };

    //Returns a selection of messages that got the most reactions with this emote, excluding self-reactions.
    const getTopMessages = async (authorId: string, emoteName: string, year?: number, limit?: number): Promise<TopMessage[]> => {
        const query = getBaseQuery(year)
            .select(["m.id as messageId", "m.channel_id as channelId", "re.name as emoteName", "re.id as emoteId"])
            .where("m.author_id", "=", authorId)
            .whereRef("r.giver_id", "!=", "r.receiver_id")
            .where("re.name", "=", emoteName)
            .groupBy(["messageId", "re.name", "re.id"])
            .orderBy("count", "desc")
            .$if(limit !== undefined, qb => qb.limit(limit!));

        return (await query.execute()).map(m => ({ ...m, count: Number(m.count) }));
    };

    return {
        find: findReaction,
        findForMessage: findReactionsForMessage,
        create: createReaction,
        delete: deleteReaction,
        deleteReactionsForMessage,
        deleteReactionsForEmote,
        getKarmaAndAwards,
        getReactionsReceived,
        getReactionsGiven,
        getEmoteLeaderboard,
        getKarmaLeaderboard,
        getTopMessages,
    };
};
