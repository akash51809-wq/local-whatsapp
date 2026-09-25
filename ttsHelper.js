const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Split text into chunks suitable for Google TTS API (max ~180 characters per request)
 */
function chunkText(text, maxLen = 180) {
  const clean = String(text || '').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const words = clean.split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [clean.substring(0, maxLen)];
}

/**
 * Fetch Google TTS MP3 buffer directly via HTTP
 */
async function fetchGoogleTTSHttp(chunk, lang = 'hi') {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    },
    timeout: 10000
  });
  return Buffer.from(response.data);
}

/**
 * Robust text-to-speech converter
 * Generates an MP3 buffer from input text using Google Text-to-Speech.
 * Zero-dependency failure: Works out of the box with axios without needing native/external packages.
 * 
 * @param {string} text 
 * @param {string} lang e.g. 'hi', 'en', 'gu', 'bn', 'ur', 'mr', 'ta', 'te'
 * @param {string} [outputFilePath]
 * @returns {Promise<{ buffer: Buffer, filePath?: string }>}
 */
async function generateTTS(text, lang = 'hi', outputFilePath = null) {
  const cleanText = String(text || '').trim();
  const targetLang = String(lang || 'hi').trim().toLowerCase();

  if (!cleanText) {
    throw new Error('Voice conversion ke liye text anivarya hai.');
  }

  // Split text into safe chunks (max ~180 chars) to prevent Google TTS truncation
  const textChunks = chunkText(cleanText, 180);
  const audioParts = [];

  for (const chunk of textChunks) {
    try {
      const partBuffer = await fetchGoogleTTSHttp(chunk, targetLang);
      if (partBuffer && partBuffer.length > 0) {
        audioParts.push(partBuffer);
      }
    } catch (err) {
      console.warn(`[ttsHelper] HTTP chunk failed for lang=${targetLang}, trying en fallback:`, err.message);
      // Fallback try with English or retry
      try {
        const fallbackBuf = await fetchGoogleTTSHttp(chunk, 'en');
        if (fallbackBuf && fallbackBuf.length > 0) {
          audioParts.push(fallbackBuf);
        }
      } catch (fbErr) {
        console.error('[ttsHelper] Fallback chunk failed:', fbErr.message);
      }
    }
  }

  const finalBuffer = Buffer.concat(audioParts);

  if (!finalBuffer || finalBuffer.length === 0) {
    throw new Error('Google Voice conversion failed: could not retrieve audio data.');
  }

  if (outputFilePath) {
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFilePath, finalBuffer);
  }

  return {
    buffer: finalBuffer,
    filePath: outputFilePath
  };
}

module.exports = {
  generateTTS,
  chunkText
};
