import { Track } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private sourceNodes: AudioBufferSourceNode[] = [];
  private startedAtCtxTime = 0;
  private playheadOffset = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async loadBuffers(tracks: Track[]): Promise<void> {
    const ctx = this.ensureContext();
    await Promise.all(
      tracks.map(async (track) => {
        try {
          const res = await fetch(track.audioUrl, { mode: 'cors' });
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(track.id, audioBuffer);
        } catch (err) {
          console.warn(`Failed to load audio for track "${track.name}":`, err);
        }
      })
    );
  }

  getBufferDuration(id: string): number {
    return this.buffers.get(id)?.duration ?? 4;
  }

  getBuffer(id: string): AudioBuffer | undefined {
    return this.buffers.get(id);
  }

  addBuffer(id: string, buffer: AudioBuffer): void {
    this.buffers.set(id, buffer);
  }

  getAudioContext(): AudioContext {
    return this.ensureContext();
  }

  setMonitorEnabled(enabled: boolean): void {
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? 1 : 0;
    }
  }

  private scheduleAllTracks(tracks: Track[]): void {
    const ctx = this.ctx!;
    const destination = this.masterGain!;
    this.sourceNodes = [];
    this.gainNodes = new Map();

    for (const track of tracks) {
      const buffer = this.buffers.get(track.id);
      if (!buffer) continue;

      const gainNode = ctx.createGain();
      gainNode.gain.value = track.enabled ? track.volume : 0;
      gainNode.connect(destination);
      this.gainNodes.set(track.id, gainNode);

      const offset = this.playheadOffset;
      const clipEnd = track.startTime + buffer.duration;

      if (offset >= clipEnd) {
        gainNode.disconnect();
        this.gainNodes.delete(track.id);
        continue;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);

      if (offset >= track.startTime) {
        source.start(this.startedAtCtxTime, offset - track.startTime);
      } else {
        source.start(this.startedAtCtxTime + (track.startTime - offset), 0);
      }

      this.sourceNodes.push(source);
    }
  }

  private stopAllSources(): void {
    for (const src of this.sourceNodes) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    this.sourceNodes = [];
    for (const gain of this.gainNodes.values()) {
      gain.disconnect();
    }
    this.gainNodes = new Map();
  }

  async play(tracks: Track[]): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (this.sourceNodes.length > 0) {
      this.playheadOffset = this.getCurrentTime();
    }
    this.stopAllSources();
    this.startedAtCtxTime = ctx.currentTime;
    this.scheduleAllTracks(tracks);
  }

  async pause(): Promise<void> {
    if (!this.ctx) return;
    this.playheadOffset += this.ctx.currentTime - this.startedAtCtxTime;
    await this.ctx.suspend();
    this.stopAllSources();
  }

  stop(): void {
    this.stopAllSources();
    this.playheadOffset = 0;
  }

  setVolume(id: string, volume: number): void {
    const gain = this.gainNodes.get(id);
    if (gain) gain.gain.value = volume;
  }

  setEnabled(id: string, enabled: boolean, volume: number): void {
    const gain = this.gainNodes.get(id);
    if (gain) gain.gain.value = enabled ? volume : 0;
  }

  getCurrentTime(): number {
    if (!this.ctx) return 0;
    if (this.ctx.state === 'suspended') return this.playheadOffset;
    return this.playheadOffset + (this.ctx.currentTime - this.startedAtCtxTime);
  }
}
