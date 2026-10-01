/**
 * Mixes the microphone with the shared screen's own audio (a tab's sound, or
 * the whole system's where the browser allows it) into the single audio track
 * MediaRecorder needs. Muting the microphone turns its gain to zero, so the
 * recording keeps going — with system sound — while the mic is off.
 */
export class AudioMixer {
  private readonly context: AudioContext;
  private readonly destination: MediaStreamAudioDestinationNode;
  private readonly micGain: GainNode | null = null;
  private readonly sources: MediaStreamAudioSourceNode[] = [];

  constructor({ microphone, system }: { microphone: MediaStream | null; system: MediaStream | null }) {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
    if (system?.getAudioTracks().length) {
      const source = this.context.createMediaStreamSource(system);
      source.connect(this.destination);
      this.sources.push(source);
    }
    if (microphone?.getAudioTracks().length) {
      const source = this.context.createMediaStreamSource(microphone);
      this.micGain = this.context.createGain();
      source.connect(this.micGain).connect(this.destination);
      this.sources.push(source);
    }
    // Created after a click, so this is normally already running; resume in case it started suspended.
    void this.context.resume().catch(() => undefined);
  }

  get track(): MediaStreamTrack | null {
    return this.destination.stream.getAudioTracks()[0] ?? null;
  }

  setMicrophoneEnabled(enabled: boolean) {
    if (this.micGain) this.micGain.gain.setValueAtTime(enabled ? 1 : 0, this.context.currentTime);
  }

  dispose() {
    for (const source of this.sources) source.disconnect();
    this.micGain?.disconnect();
    for (const track of this.destination.stream.getTracks()) track.stop();
    void this.context.close().catch(() => undefined);
  }
}

/** Whether mixing is needed: two sources must share one track. One source can be recorded directly. */
export const needsMixing = (microphone: MediaStream | null, system: MediaStream | null) =>
  Boolean(microphone?.getAudioTracks().length && system?.getAudioTracks().length);
