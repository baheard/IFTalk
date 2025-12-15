/**
 * Pronunciation Dictionary
 *
 * Manages custom pronunciation mappings for TTS.
 * Stored in localStorage for persistence.
 */

/**
 * Get the pronunciation map from localStorage
 * @returns {Object} Pronunciation map {word: pronunciation}
 */
export function getPronunciationMap() {
  const stored = localStorage.getItem('pronunciationMap');
  if (stored) {
    return JSON.parse(stored);
  }
  // Default entries
  return {
    'Anchorhead': 'Anchor-head',
    'ANCHORHEAD': 'ANCHOR-HEAD',
  };
}

/**
 * Save pronunciation map to localStorage
 * @param {Object} map - Pronunciation map to save
 */
export function savePronunciationMap(map) {
  localStorage.setItem('pronunciationMap', JSON.stringify(map));
}

/**
 * Apply pronunciation fixes to text
 * @param {string} text - Text to fix
 * @returns {string} Text with pronunciation fixes applied
 */
export function fixPronunciation(text) {
  const pronunciationMap = getPronunciationMap();

  let fixed = text;
  for (const [word, pronunciation] of Object.entries(pronunciationMap)) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    fixed = fixed.replace(regex, pronunciation);
  }

  return fixed;
}

/**
 * Add a new pronunciation mapping
 * @param {string} word - Word to add
 * @param {string} pronunciation - How to pronounce it
 */
export function addPronunciation(word, pronunciation) {
  const map = getPronunciationMap();
  map[word] = pronunciation;
  savePronunciationMap(map);
}

/**
 * Remove a pronunciation mapping
 * @param {string} word - Word to remove
 */
export function removePronunciation(word) {
  const map = getPronunciationMap();
  delete map[word];
  savePronunciationMap(map);
}
