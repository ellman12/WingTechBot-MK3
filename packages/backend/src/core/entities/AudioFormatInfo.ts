/**
 * Comprehensive audio format information detected via ffprobe.
 *
 * This structure contains validated format metadata that should be used
 * when processing audio with FFmpeg to avoid format inference errors.
 */
export type AudioFormatInfo = {
    /**
     * Primary format name (e.g., 'mp3', 'opus', 'wav', 'matroska')
     * Use this with FFmpeg's `-f` input flag
     */
    format: string;

    /**
     * Container format name (may include multiple formats: 'ogg,opus,webm')
     * Full format_name from ffprobe
     */
    container: string;

    /**
     * Audio codec name (e.g., 'mp3', 'opus', 'aac', 'vorbis', 'pcm_s16le')
     */
    codec: string;

    /**
     * Sample rate in Hz (e.g., 44100, 48000)
     */
    sampleRate: number;

    /**
     * Number of audio channels (e.g., 1 = mono, 2 = stereo)
     */
    channels: number;

    /**
     * Bitrate in bits per second (e.g., 128000 = 128 kbps)
     * May be 0 for variable bitrate or uncompressed formats
     */
    bitrate: number;

    /**
     * Duration in seconds
     * May be 0 or undefined for streams of unknown length
     */
    duration?: number;

    /**
     * Channel layout (e.g., 'mono', 'stereo', '5.1')
     * Optional - may not be present in all formats
     */
    channelLayout?: string;

    /**
     * Bit depth for PCM formats (e.g., 16, 24, 32)
     * Optional - only relevant for uncompressed audio
     */
    bitDepth?: number;
};

/**
 * Validates that AudioFormatInfo contains required audio stream data
 */
export function isValidAudioFormat(info: Partial<AudioFormatInfo>): info is AudioFormatInfo {
    return !!(info.format && info.container && info.codec && info.sampleRate && info.sampleRate > 0 && info.channels && info.channels > 0);
}

/**
 * Creates a display string for format information (useful for logging)
 */
export function formatInfoToString(info: AudioFormatInfo): string {
    const bitrateKbps = info.bitrate > 0 ? `${Math.round(info.bitrate / 1000)}kbps` : "VBR";
    const duration = info.duration ? `${info.duration.toFixed(1)}s` : "unknown";

    return `${info.codec} (${info.format}) @ ${info.sampleRate}Hz, ${info.channels}ch, ${bitrateKbps}, ${duration}`;
}
