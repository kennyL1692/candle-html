// Listens to the microphone so people can blow the candle out for real.
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let buffer: Float32Array<ArrayBuffer> | null = null;

export async function startMic(): Promise<boolean> {
  if (analyser) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    // Blowing is mostly low-frequency rumble, so ignore voices and clicks above ~700 Hz.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 700;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    buffer = new Float32Array(analyser.fftSize);
    source.connect(lowpass).connect(analyser);
    return true;
  } catch {
    stopMic();
    return false;
  }
}

export function stopMic() {
  stream?.getTracks().forEach(t => t.stop());
  ctx?.close();
  ctx = null;
  analyser = null;
  stream = null;
  buffer = null;
}

/** Loudness of the low-frequency band, roughly 0..1. */
export function readMic() {
  if (!analyser || !buffer) return 0;
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}
