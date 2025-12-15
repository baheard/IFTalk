/**
 * DOM Element References
 *
 * Centralized cache of all DOM elements used throughout the app.
 * Initialized once on page load to avoid repeated querySelector calls.
 */

export const dom = {
  // Game display
  welcome: null,
  gameOutput: null,
  gameOutputInner: null,

  // Input area
  inputArea: null,
  userInput: null,
  sendBtn: null,
  selectGameBtn: null,

  // Status and controls
  status: null,
  muteBtn: null,
  pausePlayBtn: null,
  autoplayBtn: null,

  // Voice settings
  voiceSelect: null,
  appVoiceSelect: null,
  testAppVoiceBtn: null,

  // Voice feedback
  voiceFeedback: null,
  voiceTranscript: null,
  voicePanel: null,
  lastHeard: null,
  lastResponse: null,

  // History buttons
  voiceHistoryBtn: null,
  commandHistoryBtn: null,

  // Navigation controls
  backBtn: null,
  forwardBtn: null,
  restartBtn: null,
  skipBtn: null,
  progressSlider: null,
  currentChunkSpan: null,
  totalChunksSpan: null,

  // Talk mode
  talkModeBtn: null,

  // Settings
  settingsBtn: null,
  settingsPanel: null,
  settingsPanelContent: null,
  closeSettingsBtn: null,
  addPronunciationBtn: null,
  pronunciationList: null,
  pronounceWordInput: null,
  pronounceAsInput: null,

  // Mode toggle
  aiModeToggle: null,

  // Voice meter
  voiceMeter: null,
  voiceMeterBar: null
};

/**
 * Initialize all DOM element references
 * Call this once on page load
 */
export function initDOM() {
  // Game display
  dom.welcome = document.getElementById('welcome');
  dom.gameOutput = document.getElementById('gameOutput');
  dom.gameOutputInner = document.getElementById('gameOutputInner');

  // Input area
  dom.inputArea = document.getElementById('inputArea');
  dom.userInput = document.getElementById('userInput');
  dom.sendBtn = document.getElementById('sendBtn');
  dom.selectGameBtn = document.getElementById('selectGameBtn');

  // Status and controls
  dom.status = document.getElementById('status');
  dom.muteBtn = document.getElementById('muteBtn');
  dom.pausePlayBtn = document.getElementById('pausePlayBtn');
  dom.autoplayBtn = document.getElementById('autoplayBtn');

  // Voice settings
  dom.voiceSelect = document.getElementById('voiceSelect');
  dom.appVoiceSelect = document.getElementById('appVoiceSelect');
  dom.testAppVoiceBtn = document.getElementById('testAppVoiceBtn');

  // Voice feedback
  dom.voiceFeedback = document.getElementById('voiceFeedback');
  dom.voiceTranscript = document.getElementById('voiceTranscript');
  dom.voicePanel = document.querySelector('.voice-panel');
  dom.lastHeard = document.getElementById('lastHeard');
  dom.lastResponse = document.getElementById('lastResponse');

  // History buttons
  dom.voiceHistoryBtn = document.getElementById('voiceHistoryBtn');
  dom.commandHistoryBtn = document.getElementById('commandHistoryBtn');

  // Navigation controls
  dom.backBtn = document.getElementById('backBtn');
  dom.forwardBtn = document.getElementById('forwardBtn');
  dom.restartBtn = document.getElementById('restartBtn');
  dom.skipBtn = document.getElementById('skipBtn');
  dom.progressSlider = document.getElementById('progressSlider');
  dom.currentChunkSpan = document.getElementById('currentChunk');
  dom.totalChunksSpan = document.getElementById('totalChunks');

  // Talk mode
  dom.talkModeBtn = document.getElementById('talkModeBtn');

  // Settings
  dom.settingsBtn = document.getElementById('settingsBtn');
  dom.settingsPanel = document.getElementById('settingsPanel');
  dom.settingsPanelContent = document.querySelector('.settings-panel-content');
  dom.closeSettingsBtn = document.getElementById('closeSettingsBtn');
  dom.addPronunciationBtn = document.getElementById('addPronunciationBtn');
  dom.pronunciationList = document.getElementById('pronunciationList');
  dom.pronounceWordInput = document.getElementById('pronounceWord');
  dom.pronounceAsInput = document.getElementById('pronounceAs');

  // Mode toggle
  dom.aiModeToggle = document.getElementById('aiModeToggle');

  // Voice meter
  dom.voiceMeter = document.getElementById('voiceMeter');
  dom.voiceMeterBar = document.querySelector('.voice-meter-bar');

  // Validate critical elements exist
  validateDOM();
}

/**
 * Validate that critical DOM elements exist
 * Throws error if required elements are missing
 */
function validateDOM() {
  const required = [
    'gameOutput',
    'gameOutputInner',
    'userInput',
    'status',
    'sendBtn'
  ];

  for (const elementName of required) {
    if (!dom[elementName]) {
      throw new Error(`Critical DOM element missing: ${elementName}`);
    }
  }

  console.log('[DOM] All elements initialized successfully');
}
