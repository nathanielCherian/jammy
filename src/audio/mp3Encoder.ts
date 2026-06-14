import { Mp3Encoder } from '@breezystack/lamejs';

export function encodeToMp3(buffer: AudioBuffer, bitrate = 128): Blob {
  const channels = buffer.numberOfChannels > 1 ? 2 : 1;
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, bitrate);

  const toInt16 = (f32: Float32Array): Int16Array => {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : left;
  const BLOCK = 1152; // required MPEG-1 frame size
  const mp3Data: Int8Array[] = [];

  for (let i = 0; i < left.length; i += BLOCK) {
    const chunk = encoder.encodeBuffer(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
    if (chunk.length > 0) mp3Data.push(chunk);
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Data.push(flushed);

  return new Blob(mp3Data, { type: 'audio/mpeg' });
}
