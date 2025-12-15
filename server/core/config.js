/**
 * Configuration Loader
 *
 * Loads and exports application configuration.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load configuration from config.json
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  const configPath = path.join(__dirname, '../../config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export const config = loadConfig();
