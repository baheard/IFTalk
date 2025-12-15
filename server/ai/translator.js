/**
 * AI Command Translator
 *
 * Translates natural language to IF commands using AI.
 */

import OpenAI from 'openai';
import { config } from '../core/config.js';

// Initialize AI provider
const providerConfig = config.providers[config.provider];
const apiKey = providerConfig.apiKeyEnv
  ? process.env[providerConfig.apiKeyEnv] || 'dummy-key'
  : 'not-needed';

const ai = new OpenAI({
  baseURL: config.baseURL || providerConfig.baseURL,
  apiKey: apiKey,
  defaultHeaders: config.provider === 'claude' ? {
    'anthropic-version': '2023-06-01'
  } : {}
});

const model = config.model || providerConfig.model;

/**
 * Translate natural language to IF command
 * @param {string} userInput - User's natural language input
 * @param {string} context - Current game context (room description)
 * @returns {Promise<Object>} {command, confidence, reasoning}
 */
export async function translateCommand(userInput, context = '') {
  try {
    // Build context hint from room description
    let contextHint = '';
    if (context) {
      const roomContext = context.substring(0, 600);
      contextHint = `\n\nCurrent room description:\n${roomContext}\n\nIMPORTANT: Read the room description carefully to find correct directions and object names!`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are a command translator for interactive fiction games. Convert natural language to valid IF commands.

Rules:
- Return a JSON object with: {"command": "THE_COMMAND", "confidence": 0-100, "reasoning": "brief explanation"}
- CAREFULLY read the room description to understand available exits and objects
- ONLY use objects and directions that are explicitly mentioned in the room description
- Common directions: N, S, E, W, NE, NW, SE, SW, U (up), D (down), IN, OUT
- Common actions: LOOK, EXAMINE [object], TAKE [object], DROP [object], INVENTORY (or I), OPEN [object], CLOSE [object]
- IMPORTANT: "press enter", "next", "continue" -> empty string "" (just pressing Enter)
- IMPORTANT: Don't invent objects or locations that aren't visible in the room
- IMPORTANT: If user says "look at [object]" or "examine [object]", preserve the object in the command
- Only use "LOOK" alone when user doesn't specify an object

Confidence levels:
- 90-100: Clear, unambiguous command OR standard action
- 70-89: Reasonable interpretation with explicit room context
- 50-69: Uncertain, guessing at meaning
- Below 50: Unclear input, probably wrong

Examples:
Input: "look around" -> {"command": "LOOK", "confidence": 100, "reasoning": "Standard look command"}
Input: "look at alley" -> {"command": "EXAMINE ALLEY", "confidence": 100, "reasoning": "User specified object to examine"}
Input: "press enter" -> {"command": "", "confidence": 100, "reasoning": "User wants to press Enter"}
Input: "next" -> {"command": "", "confidence": 100, "reasoning": "Continue/next means press Enter"}
Input: "go north" -> {"command": "N", "confidence": 100, "reasoning": "Clear direction"}`
      },
      {
        role: 'user',
        content: `User input: "${userInput}"${contextHint}\n\nTranslate to IF command (return JSON):`
      }
    ];

    const response = await ai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 100
    });

    const responseText = response.choices[0].message.content.trim();

    // Parse JSON response
    let result;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      result = JSON.parse(jsonText);
    } catch (parseError) {
      result = {
        command: responseText,
        confidence: 50,
        reasoning: 'AI did not return valid JSON'
      };
    }


    return result;

  } catch (error) {
    // Fallback to passing through user input
    return {
      command: userInput,
      confidence: 100,
      reasoning: 'AI translation failed, using raw input'
    };
  }
}
