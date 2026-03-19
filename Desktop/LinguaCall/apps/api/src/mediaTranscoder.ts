type TwilioOutboundFrame = {
  event: "media";
  media: {
    payload: string;
    track: "outbound";
  };
};

const MAX_FRAME_BYTES = 160;
const SAMPLE_RATE_16K = 16000;
const SAMPLE_RATE_8K = 8000;
const MU_LAW_BIAS = 33;
const MU_LAW_CLIP = 32635;

const hashTextToSeed = (text: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const splitTextIntoFrames = (frameCount: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    chunks.push(`frame_${i + 1}`);
  }
  return chunks;
};

const generatePseudoPcm16k = (text: string): Int16Array => {
  const normalized = text.trim();
  if (!normalized) {
    const silence = new Int16Array(SAMPLE_RATE_16K / 2);
    return silence;
  }

  const durationMs = Math.min(1800, 220 + normalized.length * 35);
  const sampleCount = Math.floor((SAMPLE_RATE_16K * durationMs) / 1000);
  const buffer = new Int16Array(sampleCount);
  const hash = hashTextToSeed(normalized);

  const baseFrequency = 180 + (hash % 240);
  const harmonicFrequency = 220 + ((hash >> 8) % 240);
  const amplitude = 9500 + (hash % 1500);
  const harmonicAmplitude = Math.floor(amplitude * 0.22);
  const fadeSamples = Math.max(24, Math.min(240, Math.floor(sampleCount * 0.08)));

  for (let i = 0; i < sampleCount; i += 1) {
    const ratio = i / sampleCount;
    const fadeIn = i < fadeSamples ? i / fadeSamples : 1;
    const fadeOut = i > sampleCount - fadeSamples ? (sampleCount - i) / fadeSamples : 1;
    const envelope = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const t = i / SAMPLE_RATE_16K;
    const fundamental = Math.sin(2 * Math.PI * baseFrequency * t);
    const harmonic = Math.sin(2 * Math.PI * harmonicFrequency * t * 0.5);
    const mixed = (fundamental * 0.85 + harmonic * 0.15) * amplitude * envelope;
    buffer[i] = Math.max(-32768, Math.min(32767, Math.round(mixed + harmonicAmplitude * harmonic * envelope)));
  }

  return buffer;
};

const downsample16kTo8k = (samples: Int16Array): Int16Array => {
  const outputLength = Math.floor(samples.length / 2);
  const downsampled = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const first = samples[i * 2] ?? 0;
    const second = samples[i * 2 + 1] ?? 0;
    downsampled[i] = Math.trunc((first + second) / 2);
  }
  return downsampled;
};

const linearToMulaw = (sample: number): number => {
  const sign = sample < 0 ? 0x80 : 0x00;
  let pcm = sample < 0 ? -sample : sample;
  pcm = Math.min(MU_LAW_CLIP, pcm);
  pcm += MU_LAW_BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (pcm & mask) === 0 && exponent > 0; exponent -= 1) {
    mask >>= 1;
  }

  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
};

const encodeMulawBase64Frame = (samples: Int16Array): string => {
  const encoded = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    encoded[i] = linearToMulaw(samples[i]);
  }
  return Buffer.from(encoded).toString("base64");
};

const chunkMulawPayloads = (samples: Int16Array): string[] => {
  const chunks: string[] = [];
  for (let offset = 0; offset < samples.length; offset += MAX_FRAME_BYTES) {
    const frame = samples.subarray(offset, offset + MAX_FRAME_BYTES);
    chunks.push(encodeMulawBase64Frame(frame));
  }
  return chunks;
};

const encodeTextToTwilioFrames = (text: string): TwilioOutboundFrame[] => {
  const pcm16k = generatePseudoPcm16k(text);
  const pcm8k = downsample16kTo8k(pcm16k);
  const payloads = chunkMulawPayloads(pcm8k);
  const fallbackPayloads = splitTextIntoFrames(Math.max(1, Math.min(3, payloads.length)));

  if (payloads.length === 0) {
    return fallbackPayloads.map((chunk) => ({
      event: "media",
      media: {
        track: "outbound",
        payload: Buffer.from(`fallback:${chunk}`).toString("base64")
      }
    }));
  }

  return payloads.map((payload) => ({
    event: "media",
    media: {
      track: "outbound",
      payload
    }
  }));
};

export { encodeTextToTwilioFrames };
