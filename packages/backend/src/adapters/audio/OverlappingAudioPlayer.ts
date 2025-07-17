// TODO: Implement this

// import { AudioPlayer, type AudioPlayerState, AudioResource } from "@discordjs/voice";
//
// export class OverlappingAudioPlayer extends AudioPlayer {
//     private _currentResource: AudioResource | null = null;
//
//     constructor() {
//         super();
//         this.on("stateChange", this.handleStateChange.bind(this));
//     }
//
//     private handleStateChange(oldState: AudioPlayerState, newState: AudioPlayerState) {
//         if (newState.status === "playing") {
//             this._currentResource = newState.resource;
//         } else if (newState.status === "idle" || newState.status === "paused") {
//             this._currentResource = null;
//         }
//     }
//
//     public override play(resource: AudioResource): void {
//         if (this._currentResource) {
//             // If there's already a resource playing, we can overlap
//             this.playNext(resource);
//         } else {
//             super.play(resource);
//         }
//     }
//
//     private playNext(resource: AudioResource): void {
//         // Logic to handle overlapping audio playback
//         // This could involve fading out the current resource or simply starting the new one
//         super.play(resource);
//     }
// }
