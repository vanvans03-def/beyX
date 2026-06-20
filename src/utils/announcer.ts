/**
 * Utility for voice announcements in BeyX.
 * Uses Google Translate TTS (uniform voice) via a server-side proxy.
 */

export interface AnnouncerSettings {
  enabled: boolean;
  rate: number; // Speed: 0.5 to 2.0
  volume: number; // Volume: 0.0 to 1.0
}

export const DEFAULT_ANNOUNCER_SETTINGS: AnnouncerSettings = {
  enabled: false,
  rate: 1.0,
  volume: 1.0,
};

/**
 * Clean up text for TTS.
 * Omit special characters, expand abbreviations (e.g. k.o.s -> k o s -> "เค โอ เอส"),
 * replace "vs" with "ปะทะ", and make sure words like "space" or "ช่องว่าง" are not spoken.
 */
export function preprocessAnnouncement(text: string): string {
  if (!text) return '';

  let processed = text;

  // 1. Process abbreviations like k.o.s, k.u.y, or ก.ข.ค.
  // Split into words, check if it's an acronym, and replace dots with spaces
  processed = processed
    .split(/\s+/)
    .map((word) => {
      // Matches letters followed by dots (e.g., k.o.s, K.O.S., ก.ข.ค.)
      // It checks that the word is composed of single letters separated by dots
      if (/^([a-zA-Z\u0E00-\u0E7F]\.)+[a-zA-Z\u0E00-\u0E7F]?$/.test(word)) {
        return word.replace(/\./g, ' ');
      }
      return word;
    })
    .join(' ');

  // 2. Replace "vs" (case-insensitive) with Thai "ปะทะ"
  processed = processed.replace(/\bvs\b/gi, ' ปะทะ ');

  // 3. Remove standard special characters (so they aren't read as words like "slash" or "dash")
  // Keep English letters, Thai characters, numbers, and spaces
  processed = processed.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s]/g, ' ');

  // 4. Remove literal words "space" and "ช่องว่าง" (case insensitive)
  processed = processed.replace(/space|ช่องว่าง/gi, ' ');

  // 5. Compress multiple spaces
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
}

/**
 * Announce the match via speech synthesis using proxied Google Translate TTS.
 */
export function speakText(text: string, settings: AnnouncerSettings): Promise<void> {
  const cleanText = preprocessAnnouncement(text);
  if (!cleanText) return Promise.resolve();

  return new Promise((resolve) => {
    // Call our server-side proxy API to fetch and play Google TTS audio stream
    const url = `/api/tts?text=${encodeURIComponent(cleanText)}`;
    const audio = new Audio(url);
    audio.playbackRate = settings.rate;
    audio.volume = typeof settings.volume === 'number' ? settings.volume : 1.0;

    audio.onended = () => resolve();
    audio.onerror = (e) => {
      console.error('Google TTS playback failed via proxy:', e);
      resolve();
    };

    audio.play().catch((err) => {
      console.warn('Google TTS play blocked or failed via proxy:', err);
      resolve();
    });
  });
}
