//Media probing capability. The result mirrors the ffprobe JSON schema, which is the de-facto
//interchange shape for media metadata; core parses it into AudioFormatInfo.
export type AudioProbeStream = {
    readonly codec_name: string;
    readonly codec_type: string;
    readonly sample_rate?: string;
    readonly channels?: number;
    readonly channel_layout?: string;
    readonly bits_per_sample?: number;
    readonly bit_rate?: string;
    readonly duration?: string;
};

export type AudioProbeFormat = {
    readonly format_name: string;
    readonly duration?: string;
    readonly bit_rate?: string;
};

export type AudioProbeResult = {
    readonly streams?: AudioProbeStream[];
    readonly format?: AudioProbeFormat;
};

export type AudioProbe = {
    //Probe audio streams only.
    readonly probeAudio: (input: string, timeoutMs?: number) => Promise<AudioProbeResult>;
    //Probe reading as little data as possible.
    readonly probeFast: (input: string) => Promise<AudioProbeResult>;
};
