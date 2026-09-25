import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import { isValidAudioFormat } from "@core/entities/AudioFormatInfo.js";
import { CorruptedAudioError, FormatDetectionError, UnsupportedFormatError } from "@core/errors/AudioErrors.js";
import type { AudioProbe, AudioProbeResult } from "@core/ports/services/AudioProbe.js";

// Detects audio format by probing before processing, to prevent FFmpeg inference errors.
export type AudioFormatDetectionService = {
    readonly detectFromFile: (filePath: string) => Promise<AudioFormatInfo>;
    readonly detectFromUrl: (url: string, timeout?: number) => Promise<AudioFormatInfo>;
    readonly detectFast: (input: string) => Promise<AudioFormatInfo>;
};

export type AudioFormatDetectionServiceDeps = {
    readonly audioProbe: AudioProbe;
};

// Parse probe output into AudioFormatInfo.
// Validates that an audio stream exists and extracts metadata.
const parseFormatInfo = (output: AudioProbeResult, context: { filePath?: string; url?: string }): AudioFormatInfo => {
    // Find audio stream
    const audioStream = output.streams?.find(s => s.codec_type === "audio");

    if (!audioStream) {
        throw new FormatDetectionError("No audio stream found in input", context);
    }

    // Validate we have format information
    if (!output.format) {
        throw new FormatDetectionError("No format information found in input", context);
    }

    // Extract primary format name (first in comma-separated list)
    const formatName = output.format.format_name.split(",")[0];

    // Parse numeric fields
    const sampleRate = audioStream.sample_rate ? parseInt(audioStream.sample_rate, 10) : 0;
    const channels = audioStream.channels || 0;
    const bitrate = parseInt(audioStream.bit_rate || output.format.bit_rate || "0", 10);
    const duration = parseFloat(audioStream.duration || output.format.duration || "0");

    // Build format info
    const formatInfo: Partial<AudioFormatInfo> = {
        format: formatName,
        container: output.format.format_name,
        codec: audioStream.codec_name,
        sampleRate,
        channels,
        bitrate,
        duration: duration > 0 ? duration : undefined,
        channelLayout: audioStream.channel_layout,
        bitDepth: audioStream.bits_per_sample,
    };

    // Validate required fields
    if (!isValidAudioFormat(formatInfo)) {
        throw new CorruptedAudioError("Audio stream exists but has invalid/missing metadata. File may be corrupted.", context);
    }

    // Check for unsupported formats
    if (audioStream.codec_name === "unknown" || formatName === "unknown") {
        throw new UnsupportedFormatError("Unsupported or unknown audio format", {
            format: formatName,
            codec: audioStream.codec_name,
        });
    }

    console.log("[AudioFormatDetection] Format parsed successfully", {
        formatInfo,
        context,
    });

    return formatInfo;
};

export const createAudioFormatDetectionService = ({ audioProbe }: AudioFormatDetectionServiceDeps): AudioFormatDetectionService => {
    // Detect audio format from a file path.
    const detectFromFile = async (filePath: string): Promise<AudioFormatInfo> => {
        console.log("[AudioFormatDetection] Detecting format from file", { filePath });

        try {
            const output = await audioProbe.probeAudio(filePath);
            return parseFormatInfo(output, { filePath });
        } catch (error) {
            if (error instanceof FormatDetectionError || error instanceof CorruptedAudioError) {
                throw error;
            }

            throw new FormatDetectionError(`Failed to detect format from file: ${error instanceof Error ? error.message : "Unknown error"}`, { filePath });
        }
    };

    // Detect audio format from a URL.
    const detectFromUrl = async (url: string, timeout: number = 30000): Promise<AudioFormatInfo> => {
        console.log("[AudioFormatDetection] Detecting format from URL", { url });

        try {
            const output = await audioProbe.probeAudio(url, timeout);
            return parseFormatInfo(output, { url });
        } catch (error) {
            if (error instanceof FormatDetectionError) {
                throw error;
            }

            throw new FormatDetectionError(`Failed to detect format from URL: ${error instanceof Error ? error.message : "Unknown error"}`, { url });
        }
    };

    // Fast format detection using minimal data.
    // Useful for quick validation before full processing.
    const detectFast = async (input: string): Promise<AudioFormatInfo> => {
        console.log("[AudioFormatDetection] Fast format detection", { input });

        try {
            const output = await audioProbe.probeFast(input);
            return parseFormatInfo(output, { filePath: input });
        } catch (error) {
            throw new FormatDetectionError(`Fast detection failed: ${error instanceof Error ? error.message : "Unknown error"}`, { filePath: input });
        }
    };

    return {
        detectFromFile,
        detectFromUrl,
        detectFast,
    };
};
