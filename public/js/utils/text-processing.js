/**
 * Text Processing Utilities
 *
 * Functions for processing and transforming text for TTS and display.
 */

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Process text for TTS - normalize formatting and apply transformations
 * @param {string} text - Text to process
 * @returns {string} Processed text
 */
export function processTextForTTS(text) {
  let processed = text
    // Collapse spaced capitals: "A N C H O R H E A D" → "ANCHORHEAD"
    .replace(/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g, '$1')
    // Normalize initials: "H.P." → "H P"
    .replace(/\b([A-Z])\.\s*/g, '$1 ')
    .replace(/\b([A-Z])\s+([A-Z])\s+/g, '$1$2 ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Title case for all-caps words (4+ letters): "ANCHORHEAD" → "Anchorhead"
  processed = processed.replace(/\b([A-Z]{4,})\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });

  return processed;
}

/**
 * Split processed text into sentences at delimiters
 * Used by both createNarrationChunks() and insertSentenceMarkersInHTML()
 * @param {string} processedText - Text to split
 * @returns {string[]} Array of sentence chunks
 */
export function splitIntoSentences(processedText) {
  if (!processedText) return [];

  // Split after markers OR after punctuation (when no marker present)
  // Pattern 1: Split after marker+space → keeps marker in chunk
  // Pattern 2: Split after punctuation+space when NOT followed by marker
  const chunks = processedText
    .split(/(?<=⚐\d+⚐)\s+|(?<=[.!?])(?!⚐)\s+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  // If no chunks found, use whole text
  return chunks.length > 0 ? chunks : [processedText];
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // Delete
          dp[i][j - 1],    // Insert
          dp[i - 1][j - 1] // Replace
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0 = different, 1 = identical)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity ratio 0-1
 */
export function textSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - (levenshteinDistance(str1, str2) / maxLen);
}
