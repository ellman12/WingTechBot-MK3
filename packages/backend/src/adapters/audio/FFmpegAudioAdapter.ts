import { type AudioResource, createAudioResource } from "@discordjs/voice";
import { type ChildProcess, spawn } from "child_process";

export type ExtendedAudioResource = AudioResource & {
    ffmpeg?: ChildProcess;
};

export type FFmpegOptions = {
    sampleRate?: number;
    channels?: number;
    bitrate?: string;
    format?: string;
    codec?: string;
};

export const createFFmpegAudioResource = async (url: string, _options: FFmpegOptions = {}): Promise<ExtendedAudioResource> => {
    console.log(`[FFMPEG ADAPTER] Creating FFmpeg process for URL: ${url}`);

    // Use system FFmpeg since bundled versions are causing segfaults
    const ffmpegProcess = spawn("ffmpeg", ["-i", url, "-f", "opus", "-acodec", "libopus", "-ar", "48000", "-ac", "2", "-b:a", "128k", "-loglevel", "error", "pipe:1"]);

    // Handle FFmpeg errors
    ffmpegProcess.stderr?.on("data", data => {
        const errorMessage = data.toString();
        console.error(`[FFMPEG ADAPTER] FFmpeg stderr:`, errorMessage);

        // Check for DNS-related errors
        if (errorMessage.includes("Failed to resolve hostname") || errorMessage.includes("Name or service not known")) {
            console.error(`[FFMPEG ADAPTER] DNS resolution error detected. This is likely a network configuration issue.`);
            console.error(`[FFMPEG ADAPTER] Possible solutions:`);
            console.error(`[FFMPEG ADAPTER] 1. Check if the container has internet access`);
            console.error(`[FFMPEG ADAPTER] 2. Verify DNS configuration in docker-compose`);
            console.error(`[FFMPEG ADAPTER] 3. Try using a different DNS server (e.g., 8.8.8.8)`);
        }
    });

    ffmpegProcess.on("error", error => {
        console.error(`[FFMPEG ADAPTER] FFmpeg spawn error:`, error);
    });

    ffmpegProcess.on("exit", (code, signal) => {
        console.log(`[FFMPEG ADAPTER] FFmpeg process exited with code ${code}, signal ${signal}`);
        if (code !== 0) {
            console.error(`[FFMPEG ADAPTER] FFmpeg process failed with exit code ${code}`);
        }
    });

    // Create audio resource from FFmpeg output
    const resource = createAudioResource(ffmpegProcess.stdout!, {
        inlineVolume: true,
    });

    // Store FFmpeg process on the resource for cleanup
    (resource as ExtendedAudioResource).ffmpeg = ffmpegProcess;

    console.log(`[FFMPEG ADAPTER] Created FFmpeg-based resource for remote URL`);

    return resource;
};

export const cleanupFFmpegProcess = (resource: ExtendedAudioResource): void => {
    if (resource.ffmpeg) {
        console.log(`[FFMPEG ADAPTER] Cleaning up FFmpeg process`);
        resource.ffmpeg.kill();
        resource.ffmpeg = undefined;
    }
};

export const setupFFmpegStreamMonitoring = (resource: ExtendedAudioResource, audioSource: string): void => {
    if (!audioSource.startsWith("http://") && !audioSource.startsWith("https://")) {
        return;
    }

    console.log(`[FFMPEG ADAPTER] Setting up stream monitoring for remote URL`);

    // Monitor the resource stream for errors
    if (resource.playStream) {
        resource.playStream.on("error", streamError => {
            console.error(`[FFMPEG ADAPTER] Stream error for remote URL:`, streamError);
            cleanupFFmpegProcess(resource);
        });

        resource.playStream.on("end", () => {
            console.log(`[FFMPEG ADAPTER] Stream ended for remote URL`);
            cleanupFFmpegProcess(resource);
        });

        resource.playStream.on("close", () => {
            console.log(`[FFMPEG ADAPTER] Stream closed for remote URL`);
            cleanupFFmpegProcess(resource);
        });
    }
};
