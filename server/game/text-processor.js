/**
 * Frotz Output Text Processor
 *
 * Cleans and processes Frotz interpreter output.
 * Extracts status lines, removes artifacts, and converts ANSI to HTML.
 */

import Convert from 'ansi-to-html';

// Initialize ANSI to HTML converter
const convert = new Convert({
  fg: '#e0e0e0',
  bg: 'transparent',
  newline: true,
  escapeXML: false,
  stream: false
});

/**
 * Process Frotz output - extract status line and clean up text
 * @param {string} output - Raw Frotz output
 * @returns {Object} {htmlOutput, statusLine, hasClearScreen}
 */
export function processFrotzOutput(output) {
  // Log raw output with character codes for debugging
  const chars = output.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code < 32) return `\\x${code.toString(16).padStart(2, '0')}`;
    return c;
  }).join('');

  const logLength = Math.min(800, output.length);
  if (output.length > logLength) {
  }

  // Detect clear screen codes
  const hasAnsiClear = output.includes('\x1b[2J') || output.includes('\x1b[H\x1b[2J') || output.includes('\x1b[H\x1b[J');
  const hasFormFeed = output.includes('\f') || output.includes('\x0C');
  const hasClearScreen = hasAnsiClear || hasFormFeed;

  if (hasClearScreen) {
  }

  let processedOutput = output
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '')
    .replace(/\x0C/g, '');

  // Split into lines and process each
  let lines = processedOutput.split('\n');
  let cleanedLines = [];
  let statusLine = null;

  for (let line of lines) {
    // Check for status line patterns
    if (line.match(/^\)\s+\S/)) {
      const statusContent = line.replace(/^\)\s*/, '').trim();
      if (statusContent.length > 5) {
        statusLine = statusContent;
      }
      continue;
    } else if (line.match(/^\s{1,5}\S.{10,}\s{20,}\S/)) {
      statusLine = line.trim();
      continue;
    }

    // Detect centered text
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const isCentered = leadingSpaces >= 10;

    let trimmed = line.trim();

    // Strip leading ) artifact
    if (trimmed.startsWith(') ')) {
      trimmed = trimmed.slice(2);
    }

    // Skip Frotz startup messages (when -q is not used)
    if (trimmed.startsWith('Using ANSI formatting') ||
        trimmed.startsWith('Loading ') ||
        trimmed.match(/^FROTZ V\d/)) {
      continue;
    }

    // Skip artifacts
    if (trimmed === '.' || trimmed === '. )' || trimmed === '. ' || trimmed === '') {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].text !== '') {
        cleanedLines.push({text: '', isCentered: false});
      }
      continue;
    }

    if (trimmed === ')') {
      statusLine = null;
      continue;
    }

    // Skip input prompts
    if (trimmed.match(/^[>\s]+$/)) {
      continue;
    }

    // Strip trailing prompts
    trimmed = trimmed.replace(/\s*>+\s*$/, '');

    if (trimmed) {
      const leadingWhitespace = isCentered ? line.match(/^(\s*)/)[1] : '';
      cleanedLines.push({text: trimmed, isCentered, leadingWhitespace});
    }
  }

  // Join lines with proper formatting
  let result = '';
  for (let i = 0; i < cleanedLines.length; i++) {
    const lineObj = cleanedLines[i];
    const line = lineObj.text;
    const isCentered = lineObj.isCentered;
    const leadingWhitespace = lineObj.leadingWhitespace || '';

    const wrappedLine = isCentered ? `<span class="centered">${leadingWhitespace}${line}</span>` : line;

    if (i === 0) {
      result = wrappedLine;
    } else if (line === '') {
      result += '\n\n';
    } else if (cleanedLines[i - 1].text === '') {
      result += wrappedLine;
    } else {
      result += ' <span class="soft-break"></span>' + wrappedLine;
    }
  }

  // Convert ANSI codes to HTML
  let htmlOutput = convert.toHtml(result);

  return { htmlOutput, statusLine, hasClearScreen };
}
