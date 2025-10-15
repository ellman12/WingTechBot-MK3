import { reactionScoldMessages } from "@core/services/AutoReactionService";

import { getApp } from "@/main";

import { getTestingChannel, setUpIntegrationTest, sleep } from "../../utils/testUtils";

const timeout = 60 * 1000;

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    beforeAll(async () => {
        await sleep(2000);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting AutoReactionService tests");
    });

    it("should scold self-upvotes, self-downvotes, and self-awards", async () => {
        const { emotes, testerChannel } = await setUpIntegrationTest();
        const message = await testerChannel.send("Reacting to this message");

        for (let i = 2; i <= 4; i++) {
            const [emoteName, emoteId] = emotes[i]!;
            await message.react(emoteId!);
            await sleep(5000);
            const fetchedMessage = (await testerChannel.messages.fetch({ limit: 1 }))!.first()!;

            const possibleMessages = reactionScoldMessages[emoteName!]!;
            const found = possibleMessages.find(m => fetchedMessage.content.includes(m));
            expect(found).not.toBeUndefined();

            await fetchedMessage.delete();
        }

        await message.delete();
    }, timeout);

    it("should reply 'Nice' when message contains funny substrings", async () => {
        const { testerChannel } = await setUpIntegrationTest();
        const message = await testerChannel.send("This number is 69420 lol");

        await sleep(3000);

        const fetchedMessages = await testerChannel.messages.fetch({ limit: 2 });
        const reply = fetchedMessages.find(m => m.reference?.messageId === message.id);

        expect(reply).toBeTruthy();
        expect(reply!.content).toMatch(/Nice/);
        expect(reply!.content).toMatch(/\*\*69420\*\*/);

        for (const fetched of fetchedMessages.values()) {
            await fetched.delete();
        }
    }, timeout);

}, timeout);
