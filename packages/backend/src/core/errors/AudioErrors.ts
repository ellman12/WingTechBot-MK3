/**
 * Base class for all audio-related errors in the system.
 * Provides structured error hierarchy for better error handling and debugging.
 */
export abstract class AudioError extends Error {
    constructor(
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Thrown when audio format cannot be detected or is invalid.
 * This indicates ffprobe failed to identify the audio stream.
 */
export class FormatDetectionError extends AudioError {
    constructor(message: string, context?: { filePath?: string; url?: string }) {
        super(message, context);
    }
}

/**
 * Thrown when audio download or fetch operation times out.
 * Indicates network issues or slow source.
 */
export class AudioFetchTimeoutError extends AudioError {
    constructor(message: string, context?: { url?: string; timeoutMs?: number }) {
        super(message, context);
    }
}

/**
 * Thrown when audio processing (e.g., normalization, conversion) fails.
 * This indicates FFmpeg encountered an error during processing.
 */
export class AudioProcessingError extends AudioError {
    constructor(
        message: string,
        context?: {
            inputFormat?: string;
            outputFormat?: string;
            ffmpegError?: string;
        }
    ) {
        super(message, context);
    }
}

/**
 * Thrown when audio stream is corrupted or contains invalid data.
 * Indicates the audio file/stream is malformed.
 */
export class CorruptedAudioError extends AudioError {
    constructor(message: string, context?: { filePath?: string; url?: string }) {
        super(message, context);
    }
}

/**
 * Thrown when requested audio source cannot be found.
 * This includes 404 errors, missing files, or deleted videos.
 */
export class AudioNotFoundError extends AudioError {
    constructor(message: string, context?: { filePath?: string; url?: string }) {
        super(message, context);
    }
}

/**
 * Thrown when audio source is too large to process.
 * Indicates resource limits would be exceeded.
 */
export class AudioSizeLimitError extends AudioError {
    constructor(
        message: string,
        context?: {
            sizeBytes?: number;
            limitBytes?: number;
        }
    ) {
        super(message, context);
    }
}

/**
 * Thrown when unsupported audio format is encountered.
 * Indicates the codec or container is not supported by FFmpeg.
 */
export class UnsupportedFormatError extends AudioError {
    constructor(
        message: string,
        context?: {
            format?: string;
            codec?: string;
        }
    ) {
        super(message, context);
    }
}
