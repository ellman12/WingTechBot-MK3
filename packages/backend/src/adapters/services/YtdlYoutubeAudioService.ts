import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import type { YoutubeService } from "@core/services/AudioFetcherService.js";
import type { AudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { createYtDlpService } from "@infrastructure/yt-dlp/YtDlpService.js";

export const createYtdlYoutubeService = (formatDetectionService?: AudioFormatDetectionService): YoutubeService => {
    console.log("[YtdlYoutubeService] Creating Youtube service with yt-dlp backend");
    const ytDlpService = createYtDlpService(formatDetectionService);

    return {
        fetchAudioFromYoutube: async (link: string): Promise<AudioStreamWithMetadata> => {
            console.log(`[YtdlYoutubeService] Fetching audio from YouTube: ${link}`);

            try {
                const audioWithMetadata = await ytDlpService.getAudioStreamWithFormat(link);
                console.log(`[YtdlYoutubeService] Successfully obtained audio stream with format for: ${link}`);
                return audioWithMetadata;
            } catch (error) {
                console.error(`[YtdlYoutubeService] Failed to fetch audio from YouTube: ${link}`, error);
                throw error;
            }
        },
    };
};
