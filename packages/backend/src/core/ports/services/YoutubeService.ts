import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";

export type YoutubeService = {
    readonly fetchAudioFromYoutube: (link: string) => Promise<AudioStreamWithMetadata>;
};
