import type { AudioProbe, AudioProbeResult } from "@core/ports/services/AudioProbe.js";
import type { FfprobeService } from "@infrastructure/ffmpeg/FfprobeService.js";

export type FfprobeAudioProbeDeps = {
    readonly ffprobe: FfprobeService;
};

//ffprobe's JSON output already has the shape core parses, so this is a straight pass-through.
export const createFfprobeAudioProbe = ({ ffprobe }: FfprobeAudioProbeDeps): AudioProbe => {
    return {
        probeAudio: (input: string, timeoutMs?: number): Promise<AudioProbeResult> => ffprobe.probeAudio(input, timeoutMs),
        probeFast: (input: string): Promise<AudioProbeResult> => ffprobe.probeFast(input),
    };
};
