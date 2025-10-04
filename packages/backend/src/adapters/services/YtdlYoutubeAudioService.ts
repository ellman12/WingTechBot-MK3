import type { YoutubeService } from "@core/services/AudioFetcherService.js";
import { createYtDlpService } from "@infrastructure/yt-dlp/YtDlpService.js";
import type { Readable } from "stream";

export const createYtdlYoutubeService = (): YoutubeService => {
    console.log("[YtdlYoutubeService] Creating Youtube service with yt-dlp backend");
    const ytDlpService = createYtDlpService();

    return {
        fetchAudioFromYoutube: async (link: string): Promise<Readable> => {
            console.log(`[YtdlYoutubeService] Fetching audio from YouTube: ${link}`);

            try {
                const stream = await ytDlpService.getAudioStream(link);
                console.log(`[YtdlYoutubeService] Successfully obtained audio stream for: ${link}`);
                return stream;
            } catch (error) {
                console.error(`[YtdlYoutubeService] Failed to fetch audio from YouTube: ${link}`, error);
                throw error;
            }
        },
    };
};
