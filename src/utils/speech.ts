// Reliable Cross-Platform Text-to-Speech (TTS) Engine for Maritime Dictionary
// Uses Web Audio API (AudioContext unlocked synchronously on click) + Server MP3 stream (/api/tts)
// with automatic fallback to native Web Speech API (window.speechSynthesis) for 100% offline/online reliability.

interface SpeakOptions {
  lang?: 'en' | 'tr';
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

let sharedAudioCtx: AudioContext | null = null;
let activeSourceNode: AudioBufferSourceNode | null = null;
let activeAudioElement: HTMLAudioElement | null = null;
let activeTimeoutId: number | null = null;
let activeSpeakKey: string | null = null;
let activeOnEndCallback: (() => void) | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
const audioArrayBufferCache = new Map<string, ArrayBuffer>();

// Preload browser speechSynthesis voices early
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    cachedVoices = window.speechSynthesis.getVoices() || [];
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        cachedVoices = window.speechSynthesis.getVoices() || [];
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function getOrUnlockAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function stopMaritimeSpeech(): void {
  if (activeTimeoutId !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }

  if (activeSourceNode) {
    try {
      activeSourceNode.onended = null;
      activeSourceNode.stop(0);
      activeSourceNode.disconnect();
    } catch {
      // ignore
    }
    activeSourceNode = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.onplay = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioElement = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
  }

  if (activeOnEndCallback) {
    const cb = activeOnEndCallback;
    activeOnEndCallback = null;
    activeSpeakKey = null;
    try {
      cb();
    } catch {
      // ignore
    }
  } else {
    activeSpeakKey = null;
  }
}

function findBestVoice(langCode: 'en-US' | 'tr-TR'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  try {
    const voices =
      cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices() || [];
    if (!voices || voices.length === 0) return null;

    const prefix = langCode.slice(0, 2).toLowerCase();
    const normalizedTarget = langCode.toLowerCase();

    const exactMatches = voices.filter(
      (v) => v.lang && v.lang.toLowerCase().replace('_', '-') === normalizedTarget
    );
    if (exactMatches.length > 0) {
      return (
        exactMatches.find((v) => /natural|google|siri|yelda|samantha|daniel|alex/i.test(v.name)) ||
        exactMatches[0]
      );
    }

    const prefixMatches = voices.filter(
      (v) => v.lang && v.lang.toLowerCase().startsWith(prefix)
    );
    if (prefixMatches.length > 0) {
      return (
        prefixMatches.find((v) => /natural|google|siri|yelda|samantha|daniel|alex/i.test(v.name)) ||
        prefixMatches[0]
      );
    }
  } catch {
    // ignore
  }
  return null;
}

function normalizeTextForSpeech(raw: string): string {
  return String(raw || '')
    .replace(/\b([1-9])\)\s*/g, '$1. ')
    .replace(/;\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function speakWithNativeSynthesis(
  cleanText: string,
  langCode: 'en-US' | 'tr-TR',
  rate: number,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    const wasSpeaking = synth.speaking || synth.pending;
    if (wasSpeaking) {
      synth.cancel();
    }

    const startUtterance = () => {
      try {
        if (synth.paused) {
          synth.resume();
        }
        const utterance = new SpeechSynthesisUtterance(cleanText);
        (window as unknown as { __maritimeActiveUtterance?: SpeechSynthesisUtterance }).__maritimeActiveUtterance = utterance;

        utterance.lang = langCode;
        utterance.rate = rate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const matchingVoice = findBestVoice(langCode);
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (activeTimeoutId !== null) {
            window.clearTimeout(activeTimeoutId);
            activeTimeoutId = null;
          }
          activeSpeakKey = null;
          activeOnEndCallback = null;
          onEnd?.();
        };

        activeOnEndCallback = onEnd || null;
        utterance.onstart = () => {
          onStart?.();
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        activeTimeoutId = window.setTimeout(
          finish,
          Math.max(4000, Math.min(25000, cleanText.length * 140))
        );

        onStart?.();
        synth.speak(utterance);
      } catch {
        activeSpeakKey = null;
        activeOnEndCallback = null;
        onEnd?.();
      }
    };

    if (wasSpeaking) {
      window.setTimeout(startUtterance, 40);
    } else {
      startUtterance();
    }
    return true;
  } catch {
    activeSpeakKey = null;
    activeOnEndCallback = null;
    onEnd?.();
    return false;
  }
}

async function playArrayBufferAudio(
  arrayBuf: ArrayBuffer,
  audioCtx: AudioContext | null,
  rate: number,
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  // 1. Try Web Audio API (AudioContext) first - works reliably on iOS Safari, Android Chrome, WebViews, and Desktop
  if (audioCtx) {
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const bufferCopy = arrayBuf.slice(0);
      const decodedBuffer = await audioCtx.decodeAudioData(bufferCopy);
      const source = audioCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.playbackRate.value = rate;
      source.connect(audioCtx.destination);

      activeSourceNode = source;
      activeOnEndCallback = onEnd || null;

      let ended = false;
      const handleDone = () => {
        if (ended) return;
        ended = true;
        if (activeTimeoutId !== null && typeof window !== 'undefined') {
          window.clearTimeout(activeTimeoutId);
          activeTimeoutId = null;
        }
        if (activeSourceNode === source) {
          activeSourceNode = null;
        }
        activeSpeakKey = null;
        activeOnEndCallback = null;
        onEnd?.();
      };

      source.onended = handleDone;
      const durationMs = Math.ceil((decodedBuffer.duration / Math.max(0.5, rate)) * 1000) + 800;
      activeTimeoutId = window.setTimeout(handleDone, Math.max(3000, durationMs));

      onStart?.();
      source.start(0);
      return true;
    } catch {
      // Fall through to HTMLAudioElement Blob playback
    }
  }

  // 2. Fallback to HTMLAudioElement with Blob URL
  if (typeof Audio !== 'undefined') {
    return new Promise<boolean>((resolve) => {
      try {
        const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        activeAudioElement = audio;
        activeOnEndCallback = onEnd || null;
        audio.playbackRate = rate;

        let settled = false;
        const cleanup = () => {
          URL.revokeObjectURL(blobUrl);
          if (activeTimeoutId !== null && typeof window !== 'undefined') {
            window.clearTimeout(activeTimeoutId);
            activeTimeoutId = null;
          }
          if (activeAudioElement === audio) {
            activeAudioElement = null;
          }
          activeSpeakKey = null;
          activeOnEndCallback = null;
        };

        audio.onended = () => {
          cleanup();
          onEnd?.();
        };

        audio.onerror = () => {
          cleanup();
          if (!settled) {
            settled = true;
            resolve(false);
          } else {
            onEnd?.();
          }
        };

        activeTimeoutId = window.setTimeout(() => {
          cleanup();
          onEnd?.();
        }, 20000);

        onStart?.();
        audio
          .play()
          .then(() => {
            settled = true;
            resolve(true);
          })
          .catch(() => {
            cleanup();
            if (!settled) {
              settled = true;
              resolve(false);
            }
          });
      } catch {
        resolve(false);
      }
    });
  }

  return false;
}

export function speakMaritimeText(text: string, options: SpeakOptions = {}): void {
  const cleanText = normalizeTextForSpeech(text);
  if (!cleanText || typeof window === 'undefined') return;

  const lang = options.lang || 'en';
  const langCode = lang === 'tr' ? 'tr-TR' : 'en-US';
  const rate = options.rate ?? 1.0;
  const { onStart, onEnd } = options;

  const speakKey = `${lang}:${cleanText}`;

  // Toggle off if the exact same item is currently being spoken
  if (activeSpeakKey === speakKey) {
    stopMaritimeSpeech();
    return;
  }

  stopMaritimeSpeech();
  activeSpeakKey = speakKey;

  // Unlock AudioContext synchronously during the user click event
  const audioCtx = getOrUnlockAudioContext();

  // 1. Play immediately from in-memory ArrayBuffer cache if available
  const cachedBuf = audioArrayBufferCache.get(speakKey);
  if (cachedBuf) {
    playArrayBufferAudio(cachedBuf, audioCtx, rate, onStart, onEnd).then((ok) => {
      if (!ok) {
        speakWithNativeSynthesis(cleanText, langCode, rate, onStart, onEnd);
      }
    });
    return;
  }

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  // 2. When online, fetch MP3 audio buffer from /api/tts and play via unlocked AudioContext
  if (isOnline) {
    const ttsUrl = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(cleanText)}`;
    onStart?.();
    activeOnEndCallback = onEnd || null;

    fetch(ttsUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error('TTS HTTP error');
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('audio')) throw new Error('Not audio content');
        const arrBuf = await res.arrayBuffer();
        if (!arrBuf || arrBuf.byteLength < 200) throw new Error('Empty audio buffer');
        return arrBuf;
      })
      .then(async (arrBuf) => {
        if (audioArrayBufferCache.size < 200) {
          audioArrayBufferCache.set(speakKey, arrBuf);
        }
        // Check that user hasn't cancelled or started another word while fetching
        if (activeSpeakKey !== speakKey) return;
        const played = await playArrayBufferAudio(arrBuf, audioCtx, rate, onStart, onEnd);
        if (!played && activeSpeakKey === speakKey) {
          speakWithNativeSynthesis(cleanText, langCode, rate, onStart, onEnd);
        }
      })
      .catch(() => {
        if (activeSpeakKey === speakKey) {
          speakWithNativeSynthesis(cleanText, langCode, rate, onStart, onEnd);
        }
      });
    return;
  }

  // 3. Offline: use native Web Speech API immediately inside user gesture
  speakWithNativeSynthesis(cleanText, langCode, rate, onStart, onEnd);
}
