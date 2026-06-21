import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import type { YoutubeService } from "@core/services/AudioFetcherService.js";
import type { AudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { logger } from "@core/utils/logger.js";
import { createYtDlpService } from "@infrastructure/yt-dlp/YtDlpService.js";

export const createYtdlYoutubeService = (formatDetectionService?: AudioFormatDetectionService): YoutubeService => {
    logger.debug("[YtdlYoutubeService] Creating Youtube service with yt-dlp backend");
    const ytDlpService = createYtDlpService(formatDetectionService);

    return {
        fetchAudioFromYoutube: async (link: string): Promise<AudioStreamWithMetadata> => {
            logger.debug(`[YtdlYoutubeService] Fetching audio from YouTube: ${link}`);

            try {
                const audioWithMetadata = await ytDlpService.getAudioStreamWithFormat(link);
                logger.debug(`[YtdlYoutubeService] Successfully obtained audio stream with format for: ${link}`);
                return audioWithMetadata;
            } catch (error) {
                logger.error(`[YtdlYoutubeService] Failed to fetch audio from YouTube: ${link}`, error);
                throw error;
            }
        },
    };
};
