// Connect to server via Socket.IO
const socket = io();

// DOM Elements
const welcome = document.getElementById('welcome');
const gameContainer = document.getElementById('gameport');
const gameOutput = gameContainer;
const inputArea = document.getElementById('inputArea');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const selectGameBtn = document.getElementById('selectGameBtn');
const modeToggle = document.getElementById('modeToggle');
const modeLabel = document.getElementById('modeLabel');
const status = document.getElementById('status');
const toggleTalkModeBtn = document.getElementById('toggleTalkModeBtn');
const muteBtn = document.getElementById('muteBtn');
const voiceSelect = document.getElementById('voiceSelect');
const appVoiceSelect = document.getElementById('appVoiceSelect');
const testAppVoiceBtn = document.getElementById('testAppVoiceBtn');
const voiceFeedback = document.getElementById('voiceFeedback');
const voiceMeterFill = document.getElementById('voiceMeterFill');
const voiceTranscript = document.getElementById('voiceTranscript');
const voiceHistory = document.getElementById('voiceHistory');
const voiceHistoryPanel = document.querySelector('.voice-panel');
const voiceHistoryToggle = document.getElementById('voiceHistoryToggle');
const voiceHistoryEl = document.getElementById('voiceHistory');
const commandHistory = document.getElementById('commandHistory');
const stopBtn = document.getElementById('stopBtn');
const pausePlayBtn = document.getElementById('pausePlayBtn');
const narrationProgress = document.getElementById('narrationProgress');
const narrationSlider = document.getElementById('narrationSlider');
const currentChunkLabel = document.getElementById('currentChunkLabel');
const narrationStatus = document.getElementById('narrationStatus');

// State
let currentGamePath = null;
let isListening = false;
let listeningEnabled = false;  // Continuous listening mode
let recognition = null;
let currentAudio = null;
let narrationEnabled = false;
let isMuted = false;  // Mute audio output (but keep listening)
let isNarrating = false;  // Currently speaking
let pendingNarrationText = null;
let narrationChunks = [];  // All sentences to narrate
let currentChunkIndex = 0;  // Which chunk we're on
let isPaused = false;  // Narration paused
let audioContext = null;
let analyser = null;
let microphone = null;
let voiceMeterInterval = null;
let hasProcessedResult = false;  // Track if current recognition session was processed
let hasManualTyping = false;  // Track if user has manually typed into input box
let talkModeActive = false;  // Both listening and narration active
let currentGameTextElement = null;  // Currently narrating text block for highlighting
let isUserScrubbing = false;  // Track if user is dragging the slider
let wasMutedBeforePTT = false;  // Track mute state before push-to-talk
let isPushToTalkActive = false;  // Track if push-to-talk is active
let isNavigating = false;  // Prevent concurrent navigation operations
let currentChunkStartTime = 0;  // When current chunk started playing
let confirmedTranscriptTimeout = null;  // Timeout for moving confirmed text to history
let voiceHistoryItems = [];  // Track last 3 voice commands: {text, isNavCommand}
let lastVoiceInputTime = Date.now();  // Track last voice input for idle detection
let idleCheckInterval = null;  // Interval for checking idle state

// Add voice command to history
function addToVoiceHistory(text, isNavCommand = false) {
  // Cancel any pending move-to-history
  if (confirmedTranscriptTimeout) {
    clearTimeout(confirmedTranscriptTimeout);
    confirmedTranscriptTimeout = null;
  }

  // Add to history array with metadata
  voiceHistoryItems.unshift({ text, isNavCommand });

  // Keep only last 20
  if (voiceHistoryItems.length > 20) {
    voiceHistoryItems.pop();
  }

  // Update UI
  updateVoiceHistoryUI();
}

// Update the voice history display
function updateVoiceHistoryUI() {
  voiceHistory.innerHTML = '';

  // Check if expanded
  const isExpanded = voiceHistoryToggle.classList.contains('expanded');
  const maxItems = isExpanded ? 20 : 3;

  // Show only the first N items
  const itemsToShow = voiceHistoryItems.slice(0, maxItems);

  itemsToShow.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'voice-history-item';
    div.textContent = item.text;

    // Add navigation command class
    if (item.isNavCommand) {
      div.classList.add('nav-command');
    }

    // Add aging classes (only in compact mode)
    if (!isExpanded) {
      if (index === 1) {
        div.classList.add('old');
      } else if (index === 2) {
        div.classList.add('older');
      }
    }

    voiceHistory.appendChild(div);
  });

  // Update toggle button visibility
  if (voiceHistoryItems.length > 3) {
    voiceHistoryToggle.style.display = 'flex';
  } else {
    voiceHistoryToggle.style.display = 'none';
  }
}

// Show confirmed transcript for a moment before moving to history
function showConfirmedTranscript(text, isNavCommand = false) {
  // Show as confirmed
  voiceTranscript.textContent = text;
  voiceTranscript.classList.remove('interim');
  voiceTranscript.classList.add('confirmed');

  // Add nav command styling to current transcript if applicable
  if (isNavCommand) {
    voiceTranscript.classList.add('nav-command');
  } else {
    voiceTranscript.classList.remove('nav-command');
  }

  // Move to history after 2 seconds
  confirmedTranscriptTimeout = setTimeout(() => {
    addToVoiceHistory(text, isNavCommand);

    // Reset to listening
    voiceTranscript.textContent = 'Listening...';
    voiceTranscript.classList.remove('confirmed', 'nav-command');
  }, 2000);
}

// Command history management
let commandHistoryItems = [];  // {original, translated, confidence}

function addToCommandHistory(original, translated = null, confidence = null) {
  // Add to beginning of array
  commandHistoryItems.unshift({ original, translated, confidence });

  // Keep only last 10
  if (commandHistoryItems.length > 10) {
    commandHistoryItems = commandHistoryItems.slice(0, 10);
  }

  updateCommandHistoryUI();
}

function updateCommandHistoryUI() {
  commandHistory.innerHTML = '';

  commandHistoryItems.forEach(({ original, translated, confidence }) => {
    const item = document.createElement('div');
    item.className = 'command-history-item';

    if (translated && translated.toLowerCase() !== original.toLowerCase()) {
      // Voice command with translation
      // Show voice input in blue, translated command in white
      const confidenceText = confidence ? `<span class="confidence">(${confidence}%)</span>` : '';
      item.innerHTML = `
        <div class="voice-input">
          <span class="voice-label">🎤</span>
          <span>${escapeHtml(original)}</span>
          ${confidenceText}
        </div>
        <div class="game-command">
          <span class="arrow">→</span>
          <span>${escapeHtml(translated)}</span>
        </div>
      `;
    } else {
      // Direct command (typed or no translation needed)
      // Style [ENTER] commands in gray
      if (original === '[ENTER]') {
        item.innerHTML = `<div class="game-command" style="color: #999;">${escapeHtml(original)}</div>`;
      } else {
        item.innerHTML = `<div class="game-command">${escapeHtml(original)}</div>`;
      }
    }

    commandHistory.appendChild(item);
  });
}

// Initialize voice recognition
function initVoiceRecognition() {
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
  } else if ('SpeechRecognition' in window) {
    recognition = new SpeechRecognition();
  } else {
    toggleListeningBtn.disabled = true;
    toggleListeningBtn.title = 'Speech recognition not supported';
    console.warn('[Voice] Speech recognition not available');
    return;
  }

  recognition.continuous = false;
  recognition.interimResults = true;  // Enable interim results for live display
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    hasProcessedResult = false;  // Reset for new recognition session

    if (!isNarrating) {
      updateStatus('🎤 Listening... Speak now!');
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    // Collect both interim and final results
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    // Show live transcript
    if (interimTranscript) {
      // Cancel any pending confirmed transition
      if (confirmedTranscriptTimeout) {
        clearTimeout(confirmedTranscriptTimeout);
        confirmedTranscriptTimeout = null;
      }

      voiceTranscript.textContent = interimTranscript;
      voiceTranscript.classList.remove('confirmed');
      voiceTranscript.classList.add('interim');
      console.log('[Voice] Interim:', interimTranscript);
    }

    // Process final result
    if (finalTranscript && !hasProcessedResult) {
      console.log('[Voice] Final:', finalTranscript);

      // Update last input time for idle detection
      lastVoiceInputTime = Date.now();

      // Process voice keywords first to determine if it's a nav command
      const processed = processVoiceKeywords(finalTranscript);
      const isNavCommand = (processed === false);  // Navigation commands return false

      // Show as confirmed and schedule move to history
      showConfirmedTranscript(finalTranscript, isNavCommand);

      if (processed !== false) {
        userInput.value = processed;
        hasManualTyping = false;  // This input is from voice, not manual typing
        updateStatus('Recognized: ' + finalTranscript);
      } else {
        // Command was handled (like "skip" or "pause"), clear input
        userInput.value = '';
        hasManualTyping = false;
        console.log('[Voice] Command handled, input cleared');
      }
    }
  };

  recognition.onerror = (event) => {
    // Silently ignore common expected errors
    if (event.error === 'network') {
      // Cosmetic network error in browsers - ignore completely
      return;
    } else if (event.error === 'no-speech') {
      // No speech detected - ignore silently, will restart automatically
      console.log('[Voice] No speech detected (will restart)');
    } else {
      // Unexpected error - log and show to user
      console.error('[Voice] Error:', event.error);
      updateStatus('Voice error: ' + event.error);
    }

    isListening = false;
  };

  recognition.onend = () => {
    isListening = false;

    // Only auto-send if we haven't already processed this session AND user hasn't manually typed
    const hasInput = userInput.value && userInput.value.trim();

    if (hasInput && !isNarrating && !hasProcessedResult && !hasManualTyping) {
      console.log('[Voice] OnEnd: Auto-sending:', userInput.value);
      hasProcessedResult = true;  // Mark as processed
      sendCommand();
    } else if (hasProcessedResult) {
      console.log('[Voice] OnEnd: Already processed, skipping auto-send');
    } else if (hasManualTyping) {
      console.log('[Voice] OnEnd: Manual typing detected, waiting for Enter key');
    } else if (isNarrating) {
      console.log('[Voice] OnEnd: Narrating, keeping input buffered');
    } else {
      console.log('[Voice] OnEnd: No input to send');
    }

    // ALWAYS restart listening if continuous mode enabled
    if (listeningEnabled) {
      console.log('[Voice] Restarting in 300ms...');
      setTimeout(() => {
        if (listeningEnabled) {
          try {
            // Clear transcript display only if not showing confirmed text
            if (!voiceTranscript.classList.contains('confirmed')) {
              voiceTranscript.textContent = 'Listening...';
              voiceTranscript.classList.remove('interim');
            }

            recognition.start();
          } catch (err) {
            // Ignore errors when already running
            if (err.message && !err.message.includes('already')) {
              console.error('[Voice] Restart error:', err);
            }
          }
        }
      }, 300);
    }
  };
}

// Idle detection - stop talk mode if no input for 2 minutes
function startIdleChecker() {
  // Clear any existing interval
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
  }

  console.log('[Idle] Starting idle checker');

  // Check every 30 seconds
  idleCheckInterval = setInterval(() => {
    if (!talkModeActive || isNarrating) {
      return;  // Don't check if not in talk mode or currently narrating
    }

    const idleTime = Date.now() - lastVoiceInputTime;
    const twoMinutes = 2 * 60 * 1000;

    if (idleTime >= twoMinutes) {
      console.log('[Idle] User idle for 2 minutes, stopping talk mode...');
      // Automatically stop talk mode
      toggleTalkModeBtn.click();
    }
  }, 30000);  // Check every 30 seconds
}

function stopIdleChecker() {
  if (idleCheckInterval) {
    console.log('[Idle] Stopping idle checker');
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
}

// Process voice keywords
function processVoiceKeywords(transcript) {
  let lower = transcript.toLowerCase().trim();

  // Detect spelled-out words within the transcript (e.g., "look at A L L E Y" -> "look at ALLEY")
  // Find sequences of 3+ consecutive single letters and combine them
  const words = transcript.split(/\s+/);
  let modified = false;

  for (let i = 0; i < words.length; i++) {
    // Look for sequences of single letters
    let letterSequence = [];
    let startIndex = i;

    while (i < words.length && words[i].length === 1 && /^[a-zA-Z]$/.test(words[i])) {
      letterSequence.push(words[i]);
      i++;
    }

    // If we found 3+ consecutive single letters, combine them
    if (letterSequence.length >= 3) {
      const combinedWord = letterSequence.join('').toUpperCase();
      console.log(`[Voice] Detected spelling in command: "${letterSequence.join(' ')}" -> "${combinedWord}"`);

      // Replace the letter sequence with the combined word
      words.splice(startIndex, letterSequence.length, combinedWord);
      modified = true;
      speakAppMessage(`Spelled: ${combinedWord}`);  // Confirm what we understood

      // Reset index since we modified the array - don't increment in for loop
      i = startIndex - 1;  // Will become startIndex after for loop's i++
    } else if (letterSequence.length > 0) {
      // Found some single letters but not enough - move back one since for loop will increment
      i--;
    }
    // else: no single letters found, i already advanced past current word, let for loop increment normally
  }

  // If we modified the transcript, rebuild it
  if (modified) {
    transcript = words.join(' ');
    lower = transcript.toLowerCase();
    console.log(`[Voice] Modified transcript: "${transcript}"`);
  }

  // NAVIGATION COMMANDS (work anytime, never sent to IF parser)

  // Restart - Go to beginning
  if (lower === 'restart') {
    console.log('[Voice Command] RESTART - go to beginning');
    skipToStart();
    return false;
  }

  // Back - Previous sentence
  if (lower === 'back') {
    console.log('[Voice Command] BACK - previous sentence');
    skipToChunk(-1);
    return false;
  }

  // Stop - Stop narration completely
  if (lower === 'stop') {
    console.log('[Voice Command] STOP - stop narration');
    narrationEnabled = false;
    isPaused = false;
    stopNarration();
    updateStatus('Narration stopped');
    return false;
  }

  // Pause - Pause narration
  if (lower === 'pause') {
    console.log('[Voice Command] PAUSE');
    if (isNarrating) {
      narrationEnabled = false;
      isPaused = true;
      stopNarration();
      updateStatus('Narration paused');
    }
    return false;
  }

  // Play - Resume/Start narration
  if (lower === 'play') {
    console.log('[Voice Command] PLAY - resume/start');
    if (!narrationEnabled && (isPaused || pendingNarrationText || narrationChunks.length > 0)) {
      narrationEnabled = true;
      isPaused = false;

      if (narrationChunks.length > 0) {
        // Resume from current position
        speakTextChunked(null, currentChunkIndex);
      } else if (pendingNarrationText) {
        // Start new narration (create chunks first if not already created)
        createNarrationChunks(pendingNarrationText);
        pendingNarrationText = null;
        speakTextChunked(null, 0);
      }
    }
    return false;
  }

  // Skip - Next sentence
  if (lower === 'skip') {
    console.log('[Voice Command] SKIP - next sentence');
    skipToChunk(1);
    return false;
  }

  // Skip All - Skip to end (various phrasings)
  if (lower === 'skip all' || lower === 'skip to end' || lower === 'skip to the end' || lower === 'end') {
    console.log('[Voice Command] SKIP TO END');
    skipToEnd();
    return false;
  }

  // During narration, ignore all non-navigation commands
  if (isNarrating) {
    console.log('[Voice] Ignored during narration:', transcript);
    updateStatus('🔊 Narrating... Use navigation commands');
    return false;
  }

  // GAME COMMANDS (sent to IF parser)

  // GAME COMMANDS - check mode (same toggle for both voice and text)
  const isAIMode = modeToggle.checked;

  // "Next" or "Enter" or "More" - Send empty command (press Enter)
  if (lower === 'next' || lower === 'enter' || lower === 'more') {
    console.log(`[Voice Command] ${lower.toUpperCase()} - pressing Enter`);
    sendCommandDirect('');
    return false;
  }

  // "Print [text]" - Literal text bypass (always direct)
  const printMatch = transcript.match(/^print\s+(.+)$/i);
  if (printMatch) {
    const literalText = printMatch[1];
    console.log('[Voice Command] PRINT - literal:', literalText);
    sendCommandDirect(literalText);
    return false;
  }

  // Regular command - use voice mode setting
  if (isAIMode) {
    // AI Mode: read back and return for translation
    console.log('[Voice] AI Mode - will translate:', transcript);
    speakAppMessage(transcript);  // Read back what we heard
    return transcript;
  } else {
    // Direct Mode: read back and send directly
    console.log('[Voice] Direct Mode - sending:', transcript);
    speakAppMessage(transcript);  // Read back what we heard
    sendCommandDirect(transcript);
    return false;
  }
}

// Speak feedback using app voice (for confirmations, not narration)
function speakAppMessage(text) {
  if (!('speechSynthesis' in window) || !text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const appVoice = voices.find(v => v.name === browserVoiceConfig.appVoice);

  if (appVoice) {
    utterance.voice = appVoice;
  }

  utterance.rate = 1.3;  // Faster for quick confirmations
  utterance.pitch = 1.0;
  utterance.volume = 0.8;  // Slightly quieter than narration

  speechSynthesis.speak(utterance);
}

// Update status
function updateStatus(message, type = '') {
  status.textContent = message;
  status.className = 'status ' + type;
}

// Add text to output
function addGameText(text, isCommand = false) {
  const div = document.createElement('div');

  if (isCommand) {
    div.className = 'user-command';

    // Don't show [ENTER] for empty commands - just show >
    if (text === '' || text === '[ENTER]') {
      div.innerHTML = `<span class="command-label">&gt;</span> <span style="color: #999;">[ENTER]</span>`;
    } else {
      div.innerHTML = `<span class="command-label">&gt;</span> ${escapeHtml(text)}`;
    }
  } else {
    // Text is now HTML from ANSI-to-HTML conversion
    // Strip HTML tags to get plain text for sentence splitting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Clean up display text (remove stray formatting artifacts)
    let displayText = plainText
      .replace(/^\s*\.\s*$/gm, '')  // Remove lines with just dots
      .replace(/^\s*\)\s*$/gm, '')  // Remove lines with just parentheses
      .replace(/^\n+/g, '')  // Remove leading newlines
      .replace(/\n{3,}/g, '\n\n');  // Max 2 newlines in a row

    div.className = 'game-text';

    // Split into sentences and wrap each in a span for individual highlighting
    // Use split with capturing groups to keep delimiters and handle trailing text
    // Don't trim() here - preserve leading spaces for game formatting (centering, etc.)
    const parts = displayText.split(/([.!?]+)/);
    let sentences = [];

    // Recombine sentence parts with their punctuation
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i]) {
        const sentence = parts[i] + (parts[i + 1] || '');
        // Don't trim - preserve leading/trailing spaces for IF formatting
        sentences.push(sentence);
      }
    }

    // Fallback if no sentences found
    if (sentences.length === 0) {
      // Don't trim - preserve spacing
      sentences = [displayText];
    }

    let html = '';
    sentences.forEach((sentence, index) => {
      if (sentence) {  // Only add non-empty sentences
        // Don't escape - text is already HTML from ANSI conversion
        html += `<span class="sentence-chunk" data-chunk-index="${index}">${escapeHtml(sentence)}</span>`;
      }
    });

    // Actually, let's just render the HTML directly without sentence wrapping for now
    // to preserve ANSI styling properly
    div.innerHTML = text;
  }

  gameOutput.appendChild(div);

  // Scroll to show the TOP of new text (not bottom)
  // This ensures long text blocks are visible from the start
  div.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return div;  // Return the element for highlighting later
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Stop narration (for "Skip" command or internal use)
function stopNarration() {
  // Cancel browser TTS if active
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // CRITICAL: Remove ALL pending audio-ready handlers to prevent stale audio
  // from previous requests being picked up by the next narration cycle
  socket.off('audio-ready');

  isNarrating = false;
  isPaused = true;  // IMPORTANT: Set paused to stop the async loop

  // Only update status if not showing something else
  if (status.textContent.includes('Speaking')) {
    updateStatus('Ready');
  }
}

// Play audio (supports both base64 audio from ElevenLabs and browser TTS)
async function playAudio(audioDataOrText) {
  if (!audioDataOrText || !narrationEnabled || isMuted) {
    if (isMuted) {
      console.log('[Audio] Skipped - muted');
    }
    return;
  }

  // Just stop any currently playing audio/speech without changing state flags
  // (The calling code manages isPaused/narrationEnabled state)
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  isNarrating = true;
  updateStatus('🔊 Speaking... (say "Skip" to stop)', 'speaking');
  updateNavButtons();  // Update pause/play button icon immediately

  // Check if using browser TTS (plain text) or audio file (base64)
  if (typeof audioDataOrText === 'string' && audioDataOrText.length < 1000) {
    // Probably text for browser TTS
    return playWithBrowserTTS(audioDataOrText);
  }

  // ElevenLabs audio (base64)
  const audio = new Audio('data:audio/mpeg;base64,' + audioDataOrText);
  currentAudio = audio;

  return new Promise((resolve) => {
    audio.onended = () => {
      currentAudio = null;
      isNarrating = false;
      updateStatus('Ready');
      updateNavButtons();  // Update pause/play button icon
      resolve();
    };

    audio.onerror = () => {
      console.error('[Audio] Playback error');
      currentAudio = null;
      isNarrating = false;
      updateStatus('Audio error');
      updateNavButtons();  // Update pause/play button icon
      resolve();
    };

    audio.play().catch(err => {
      console.error('[Audio] Failed:', err);
      currentAudio = null;
      isNarrating = false;
      updateStatus('Audio playback failed');
      resolve();
    });
  });
}

// Browser voice config (loaded from server)
let browserVoiceConfig = {
  voice: 'Microsoft David Desktop',
  appVoice: 'Microsoft Zira Desktop',  // Separate voice for app messages
  rate: 1.1,
  pitch: 1.0
};

// Populate voice dropdowns
function populateVoiceDropdown() {
  const voices = speechSynthesis.getVoices();

  if (voices.length === 0) {
    setTimeout(populateVoiceDropdown, 100);  // Retry
    return;
  }

  // Populate narrator voice dropdown
  voiceSelect.innerHTML = '';
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;

    // Select configured voice
    if (voice.name === browserVoiceConfig.voice) {
      option.selected = true;
    }

    voiceSelect.appendChild(option);
  });

  // Populate app voice dropdown
  appVoiceSelect.innerHTML = '';
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;

    // Select configured app voice
    if (voice.name === browserVoiceConfig.appVoice) {
      option.selected = true;
    }

    appVoiceSelect.appendChild(option);
  });

  console.log('[Voice Dropdown] Loaded', voices.length, 'voices');
}

// Handle voice selection
voiceSelect.addEventListener('change', (e) => {
  browserVoiceConfig.voice = e.target.value;
  console.log('[Voice] Changed to:', e.target.value);
  updateStatus(`Voice changed to: ${e.target.value}`);
});

// Test voice button
document.getElementById('testVoiceBtn').addEventListener('click', () => {
  const selectedVoice = voiceSelect.value;

  if (!selectedVoice || !('speechSynthesis' in window)) {
    updateStatus('Voice not available');
    return;
  }

  const testText = 'Hello! This is how I sound. You are standing in a dark room with a mysterious door.';

  const utterance = new SpeechSynthesisUtterance(testText);
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.name === selectedVoice);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = browserVoiceConfig.rate || 1.1;
  utterance.pitch = browserVoiceConfig.pitch || 1.0;

  speechSynthesis.cancel();  // Stop any current speech
  speechSynthesis.speak(utterance);

  console.log('[Voice Test] Playing sample with:', selectedVoice);
  updateStatus('Testing voice: ' + selectedVoice);
});

// Handle app voice selection
appVoiceSelect.addEventListener('change', (e) => {
  browserVoiceConfig.appVoice = e.target.value;
  localStorage.setItem('appVoice', e.target.value);  // Persist selection
  console.log('[App Voice] Changed to:', e.target.value);
  updateStatus(`App voice changed to: ${e.target.value}`);
});

// Test app voice button
testAppVoiceBtn.addEventListener('click', () => {
  const selectedVoice = appVoiceSelect.value;

  if (!selectedVoice || !('speechSynthesis' in window)) {
    updateStatus('App voice not available');
    return;
  }

  const testText = 'Hello! This is the app voice. I will use this voice to ask you questions and provide prompts.';

  const utterance = new SpeechSynthesisUtterance(testText);
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.name === selectedVoice);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = browserVoiceConfig.rate || 1.1;
  utterance.pitch = browserVoiceConfig.pitch || 1.0;

  speechSynthesis.cancel();  // Stop any current speech
  speechSynthesis.speak(utterance);

  console.log('[App Voice Test] Playing sample with:', selectedVoice);
  updateStatus('Testing app voice: ' + selectedVoice);
});

// Load browser voice config
async function loadBrowserVoiceConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();

    if (config.voice?.tts?.browser) {
      browserVoiceConfig = config.voice.tts.browser;
      console.log('[Browser TTS] Config loaded:', browserVoiceConfig);
    }
  } catch (error) {
    console.error('[Browser TTS] Failed to load config:', error);
  }

  // Load app voice from localStorage
  const savedAppVoice = localStorage.getItem('appVoice');
  if (savedAppVoice) {
    browserVoiceConfig.appVoice = savedAppVoice;
    console.log('[App Voice] Loaded from localStorage:', savedAppVoice);
  }

  // Populate dropdown after loading config
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = populateVoiceDropdown;
    populateVoiceDropdown();
  }
}

// Speak text using the app voice (for questions, prompts, etc.)
async function speakWithAppVoice(text) {
  if (!text || !('speechSynthesis' in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.name === browserVoiceConfig.appVoice);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = browserVoiceConfig.rate || 1.1;
  utterance.pitch = browserVoiceConfig.pitch || 1.0;

  // Cancel any current speech and speak
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);

  console.log('[App Voice] Speaking:', text.substring(0, 50) + '...');
}

// Pronunciation dictionary - fix common mispronunciations
function getPronunciationMap() {
  const stored = localStorage.getItem('pronunciationMap');
  if (stored) {
    return JSON.parse(stored);
  }
  // Default entries
  return {
    'Anchorhead': 'Anchor-head',
    'ANCHORHEAD': 'ANCHOR-HEAD',
    'Photopia': 'Foto-pia',
    'PHOTOPIA': 'FOTO-PIA',
    'Violet': 'Vy-o-let',
    'VIOLET': 'VY-O-LET'
  };
}

function savePronunciationMap(map) {
  localStorage.setItem('pronunciationMap', JSON.stringify(map));
}

function fixPronunciation(text) {
  const pronunciationMap = getPronunciationMap();

  let fixed = text;
  for (const [word, pronunciation] of Object.entries(pronunciationMap)) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    fixed = fixed.replace(regex, pronunciation);
  }

  return fixed;
}

// Play using browser's built-in TTS (100% FREE!)
async function playWithBrowserTTS(text) {
  if (!('speechSynthesis' in window)) {
    console.error('[Browser TTS] Not supported');
    isNarrating = false;
    return;
  }

  // Fix pronunciation issues before speaking
  const fixedText = fixPronunciation(text);

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(fixedText);

    // Find configured voice
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === browserVoiceConfig.voice);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('[Browser TTS] Using voice:', selectedVoice.name);
    } else {
      // Fallback to default
      console.warn('[Browser TTS] Voice not found:', browserVoiceConfig.voice, '- using default');
    }

    utterance.rate = browserVoiceConfig.rate || 1.1;
    utterance.pitch = browserVoiceConfig.pitch || 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      isNarrating = false;
      updateStatus('Ready');
      updateNavButtons();  // Update pause/play button icon
      resolve();
    };

    utterance.onerror = (err) => {
      // Silently ignore 'interrupted' errors (happens when we stop narration)
      if (err.error === 'interrupted') {
        console.log('[Browser TTS] Interrupted (expected)');
      } else {
        console.error('[Browser TTS] Error:', err);
        updateStatus('TTS error');
      }
      isNarrating = false;
      updateNavButtons();  // Update pause/play button icon
      resolve();
    };

    // Stop any current speech
    speechSynthesis.cancel();

    // Speak
    speechSynthesis.speak(utterance);
    console.log('[Browser TTS] Speaking:', text.substring(0, 50) + '...');
  });
}

// Create narration chunks from text (called for ALL new text, regardless of narration state)
function createNarrationChunks(text) {
  if (!text) return;

  console.log('[TTS] Creating narration chunks');

  // Split into chunks for new text
  // Strip any existing HTML tags from server (ANSI conversion produces <br/> tags)
  // Convert to plain text first
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';

  // Use unique markers that won't appear in game text
  const SINGLE_NEWLINE_MARKER = '\x00LINEBREAK\x00';
  const PARAGRAPH_MARKER = '\x00PARAGRAPH\x00';

  let textWithMarkers = plainText
    .replace(/\n\n+/g, PARAGRAPH_MARKER)  // Double newlines -> paragraph marker
    .replace(/\n/g, SINGLE_NEWLINE_MARKER);  // Single newlines -> line break marker

  // Pre-process text to normalize before chunking (for TTS)
  let processedText = textWithMarkers
    // Replace newline markers with spaces for smooth TTS
    .replace(new RegExp(SINGLE_NEWLINE_MARKER, 'g'), ' ')
    .replace(new RegExp(PARAGRAPH_MARKER, 'g'), ' ')
    // Detect and collapse spaced-out capital letters (e.g., "A N C H O R H E A D" -> "ANCHORHEAD")
    .replace(/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g, '$1')
    // Then normalize initials to prevent "H.P. Lovecraft" from being split
    .replace(/\b([A-Z])\.\s*/g, '$1 ')  // H.P. -> H P
    .replace(/\b([A-Z])\s+([A-Z])\s+/g, '$1$2 ')  // H P -> HP
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Convert collapsed all-caps words (4+ letters) to title case for better pronunciation
  // (e.g., "ANCHORHEAD" -> "Anchorhead")
  processedText = processedText.replace(/\b([A-Z]{4,})\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });

  // Split by sentence boundaries for TTS chunks
  narrationChunks = processedText
    .split(/(?<=[.!?])\s+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  // If no chunks found, use whole text
  if (narrationChunks.length === 0) {
    narrationChunks = [processedText];
  }

  // Now process for display - keep markers to preserve formatting
  let displayText = textWithMarkers
    // Collapse spaced capital letters for display too
    .replace(/\b([A-Z])\s+(?=[A-Z](?:\s+[A-Z]|\s*\b))/g, '$1')
    // Normalize initials
    .replace(/\b([A-Z])\.\s*/g, '$1 ')
    .replace(/\b([A-Z])\s+([A-Z])\s+/g, '$1$2 ')
    // Clean up spaces but keep markers
    .replace(/  +/g, ' ');

  // Convert to title case for display
  displayText = displayText.replace(/\b([A-Z]{4,})\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });

  // Split display text by sentences while preserving markers
  // Don't trim() - preserve leading spaces for IF centering
  const displaySentences = displayText
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 0);

  // Build display HTML with preserved formatting
  if (currentGameTextElement) {
    let html = '';

    displaySentences.forEach((sentence, index) => {
      // Convert markers to HTML tags BEFORE escaping
      let displayHTML = sentence
        .replace(new RegExp(PARAGRAPH_MARKER, 'g'), '<br><br>')
        .replace(new RegExp(SINGLE_NEWLINE_MARKER, 'g'), '<br>');

      // Now escape any HTML in the actual text content
      // Split by our HTML tags, escape text parts, rejoin
      const parts = displayHTML.split(/(<br>|<br><br>)/);
      displayHTML = parts.map(part => {
        if (part === '<br>' || part === '<br><br>') {
          return part;  // Keep HTML tags as-is
        }
        return escapeHtml(part);  // Escape text content
      }).join('');

      // Use index for highlighting (may not perfectly align with narration chunks, but close)
      const chunkIndex = Math.min(index, narrationChunks.length - 1);
      html += `<span class="sentence-chunk" data-chunk-index="${chunkIndex}">${displayHTML}</span> `;
    });

    currentGameTextElement.innerHTML = html.trim();
  }

  console.log('[TTS] Created', narrationChunks.length, 'chunks');
  console.log('[TTS] Chunks:', narrationChunks.map((c, i) => `[${i}]: ${c.substring(0, 30)}...`));
}

// Speak text in chunks (with resume and navigation support)
async function speakTextChunked(text, startFromIndex = 0) {
  // Check if narration is enabled at the very start
  if (!narrationEnabled) {
    console.log('[TTS] Narration disabled, not starting');
    return;
  }

  // Stop any currently playing narration to prevent double voices
  if (currentAudio) {
    console.log('[TTS] Stopping previous narration');
    stopNarration();
  }

  // Split into chunks if this is new text
  if (text) {
    createNarrationChunks(text);
  }

  currentChunkIndex = startFromIndex;
  isPaused = false;

  // Start from current index
  for (let i = currentChunkIndex; i < narrationChunks.length; i++) {
    // Check narration state at start of EVERY iteration
    if (!narrationEnabled || isPaused) {
      console.log('[TTS] Loop stopped at chunk', i, '- narrationEnabled:', narrationEnabled, 'isPaused:', isPaused);
      currentChunkIndex = i;  // Save position

      // Remove highlighting from current sentence
      if (currentGameTextElement) {
        const currentSentence = currentGameTextElement.querySelector(`[data-chunk-index="${i}"]`);
        if (currentSentence) {
          currentSentence.classList.remove('speaking');
        }
      }
      break;
    }

    currentChunkIndex = i;
    updateNavButtons();

    // Highlight current sentence
    updateTextHighlight(i);

    const chunkText = narrationChunks[i];
    console.log(`[TTS] Playing chunk ${i + 1}/${narrationChunks.length}: "${chunkText.substring(0, 50)}..."`);

    // Request audio from server
    socket.emit('speak-text', narrationChunks[i]);

    // Wait for audio
    const audioData = await new Promise((resolve) => {
      const handler = (data) => {
        socket.off('audio-ready', handler);
        resolve(data);
      };
      socket.on('audio-ready', handler);
    });

    // Check again if we should still play (user might have skipped while waiting)
    if (!narrationEnabled || isPaused || currentChunkIndex !== i) {
      console.log('[TTS] Cancelled - navigation changed while waiting for audio');

      // Remove highlighting when cancelled
      if (currentGameTextElement) {
        const allSentences = currentGameTextElement.querySelectorAll('.sentence-chunk');
        allSentences.forEach(s => s.classList.remove('speaking'));
      }
      break;
    }

    if (audioData) {
      // Mark when this chunk started playing (for smart back button)
      currentChunkStartTime = Date.now();

      // Highlight text in Parchment output
      highlightSpokenText(chunkText);

      await playAudio(audioData);

      // Remove highlight after audio finishes
      removeHighlight();
    }
  }

  // Finished all chunks
  if (currentChunkIndex >= narrationChunks.length - 1 && narrationEnabled && !isPaused) {
    console.log('[TTS] Narration complete');

    // Keep position at last chunk (don't jump)
    currentChunkIndex = narrationChunks.length - 1;

    // Remove highlighting when narration completes
    if (currentGameTextElement) {
      const allSentences = currentGameTextElement.querySelectorAll('.sentence-chunk');
      allSentences.forEach(s => s.classList.remove('speaking'));
    }

    // Scroll to bottom when narration finishes
    if (gameOutput) {
      gameOutput.scrollTop = gameOutput.scrollHeight;
    }

    updateNavButtons();
  }
}

// Navigate chunks
function skipToChunk(offset) {
  // Prevent concurrent navigation
  if (isNavigating) {
    console.log('[TTS] Navigation already in progress, ignoring');
    return;
  }

  let targetIndex = currentChunkIndex + offset;

  // Smart back button: if going back and within 500ms of current chunk start, go to previous chunk instead
  if (offset === -1) {
    const timeSinceStart = Date.now() - currentChunkStartTime;
    if (timeSinceStart < 500 && currentChunkIndex > 0) {
      // Within 500ms, go to previous chunk
      targetIndex = currentChunkIndex - 1;
      console.log(`[TTS] Smart back: within 500ms (${timeSinceStart}ms), going to previous chunk ${targetIndex}`);
    } else {
      // Past 500ms, restart current chunk
      targetIndex = currentChunkIndex;
      console.log(`[TTS] Smart back: past 500ms (${timeSinceStart}ms), restarting current chunk ${targetIndex}`);
    }
  }

  if (targetIndex < 0 || targetIndex >= narrationChunks.length) {
    console.log('[TTS] Cannot skip - out of bounds');
    return;
  }

  console.log(`[TTS] Skipping from chunk ${currentChunkIndex} to ${targetIndex}`);

  isNavigating = true;

  // Check if narration is enabled (should resume after navigation)
  const shouldResume = narrationEnabled;

  // Stop current playback immediately
  stopNarration();
  currentChunkIndex = targetIndex;

  // Update buttons immediately
  updateNavButtons();

  // Small delay to prevent rapid navigation loops
  setTimeout(() => {
    isNavigating = false;

    // Update highlighting
    updateTextHighlight(targetIndex);

    // Auto-resume if narration was enabled
    if (shouldResume) {
      console.log(`[TTS] Auto-resuming from chunk ${targetIndex}`);
      isPaused = false;
      narrationEnabled = true;
      speakTextChunked(null, targetIndex);
    } else {
      // Just update highlight if not playing
      isPaused = true;
    }
  }, 100);
}

// Skip to beginning
function skipToStart() {
  if (narrationChunks.length === 0 || isNavigating) return;

  console.log('[TTS] Skipping to start');

  isNavigating = true;
  currentChunkStartTime = 0;  // Reset timestamp

  // Check if narration is enabled (should resume after navigation)
  const shouldResume = narrationEnabled;

  stopNarration();
  currentChunkIndex = 0;
  updateNavButtons();

  setTimeout(() => {
    isNavigating = false;

    // Update highlighting
    updateTextHighlight(0);

    // Auto-resume if narration was enabled
    if (shouldResume) {
      isPaused = false;
      narrationEnabled = true;
      speakTextChunked(null, 0);
    } else {
      isPaused = true;
    }
  }, 100);
}

// Skip to end
function skipToEnd() {
  if (narrationChunks.length === 0) return;

  console.log('[TTS] FORCE SKIP TO END - stopping all narration');

  // Force stop everything immediately
  narrationEnabled = false;  // Disable narration FIRST
  isPaused = true;           // Set paused state
  isNavigating = false;      // Don't block navigation

  // Stop audio immediately
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // Stop browser TTS
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  isNarrating = false;

  // Jump to end
  currentChunkIndex = narrationChunks.length - 1;
  currentChunkStartTime = 0;

  updateNavButtons();
  updateStatus('⏩ Skipped to end');

  // Remove all highlighting
  if (currentGameTextElement) {
    const allSentences = currentGameTextElement.querySelectorAll('.sentence-chunk');
    allSentences.forEach(s => s.classList.remove('speaking'));
  }

  // Scroll to bottom of game output
  if (gameOutput) {
    gameOutput.scrollTop = gameOutput.scrollHeight;
  }

  console.log('[TTS] Force stop complete - position:', currentChunkIndex + 1, '/', narrationChunks.length);
}

// Update text highlighting for a specific chunk
function updateTextHighlight(chunkIndex) {
  if (!currentGameTextElement || narrationChunks.length === 0) return;

  // Remove highlight from all sentences
  const allSentences = currentGameTextElement.querySelectorAll('.sentence-chunk');
  allSentences.forEach(s => s.classList.remove('speaking'));

  // Highlight the specified sentence
  const targetSentence = currentGameTextElement.querySelector(`[data-chunk-index="${chunkIndex}"]`);
  if (targetSentence) {
    targetSentence.classList.add('speaking');

    // Scroll to show the highlighted sentence
    targetSentence.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Update navigation button states
function updateNavButtons() {
  const skipToStartBtn = document.getElementById('skipToStartBtn');
  const prevBtn = document.getElementById('prevChunkBtn');
  const nextBtn = document.getElementById('nextChunkBtn');
  const skipToEndBtn = document.getElementById('skipToEndBtn');

  if (skipToStartBtn) {
    skipToStartBtn.disabled = currentChunkIndex <= 0;
  }

  if (prevBtn) {
    prevBtn.disabled = currentChunkIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = currentChunkIndex >= narrationChunks.length - 1;
  }

  if (skipToEndBtn) {
    skipToEndBtn.disabled = currentChunkIndex >= narrationChunks.length - 1;
  }

  // Update pause/play button icon
  if (pausePlayBtn) {
    // Show PAUSE icon when actively playing, PLAY icon when paused/stopped
    const isPlaying = isNarrating && narrationEnabled && !isPaused;
    const iconSpan = pausePlayBtn.querySelector('.material-icons');
    if (isPlaying) {
      if (iconSpan) iconSpan.textContent = 'pause';
      pausePlayBtn.title = 'Pause';
    } else {
      if (iconSpan) iconSpan.textContent = 'play_arrow';
      pausePlayBtn.title = 'Play';
    }
  }

  // Update slider and progress display
  if (narrationChunks.length > 0) {
    narrationProgress.classList.remove('hidden');
    narrationSlider.max = narrationChunks.length - 1;

    if (!isUserScrubbing) {
      narrationSlider.value = currentChunkIndex;
    }

    currentChunkLabel.textContent = `${currentChunkIndex + 1} / ${narrationChunks.length}`;

    // Update status
    if (isNarrating) {
      narrationStatus.textContent = '🔊 Playing';
    } else if (isPaused) {
      narrationStatus.textContent = '⏸️ Paused';
    } else {
      narrationStatus.textContent = 'Ready';
    }

    const position = `(${currentChunkIndex + 1}/${narrationChunks.length})`;
    console.log('[Nav] Position:', position);
  } else {
    narrationProgress.classList.add('hidden');
  }
}

// Start game
async function startGame(gamePath) {
  try {
    currentGamePath = gamePath;
    updateStatus('Starting game...', 'processing');

    // Hide welcome, show game container and input
    welcome.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    inputArea.classList.remove('hidden');

    // Stop any existing narration
    stopNarration();

    console.log('[ZVM] Loading game:', gamePath);

    // Verify libraries are loaded
    if (typeof window.ZVM === 'undefined') {
      console.error('[ZVM] ZVM library not loaded');
      updateStatus('Error: Game engine not loaded');
      return;
    }
    if (typeof window.Glk === 'undefined') {
      console.error('[ZVM] Glk library not loaded');
      updateStatus('Error: Glk library not loaded');
      return;
    }
    if (typeof window.GlkOte === 'undefined') {
      console.error('[ZVM] GlkOte library not loaded');
      updateStatus('Error: GlkOte library not loaded');
      return;
    }

    // Fetch the story file as binary data
    updateStatus('Downloading game file...', 'processing');
    const response = await fetch(gamePath);
    if (!response.ok) {
      throw new Error(`Failed to load game file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const storyData = new Uint8Array(arrayBuffer);
    console.log('[ZVM] Story file loaded:', storyData.length, 'bytes');

    // Create ZVM instance
    const vm = new window.ZVM();
    window.zvmInstance = vm;

    // Prepare VM with story data and Glk reference (but don't start yet)
    console.log('[ZVM] Preparing VM...');
    vm.prepare(storyData, {
      Glk: window.Glk
    });

    // Create Game interface for GlkOte
    window.Game = {
      gameport: 'gameport',  // ID of the container element
      spacing: 4,
      accept: function(event) {
        console.log('[Game] Received event:', event.type);

        if (event.type === 'init') {
          // GlkOte has measured the gameport and provided metrics
          console.log('[Game] Init event received with metrics');

          // Now initialize Glk with the VM
          console.log('[ZVM] Initializing Glk...');
          window.Glk.init({
            vm: vm,
            GlkOte: window.GlkOte
          });

          // Start VM execution - this will create windows using the metrics
          console.log('[ZVM] Starting VM...');
          vm.start();

          console.log('[ZVM] Game initialized successfully');
          updateStatus('Ready - Click "Start Talk Mode" for voice');

          // Reset generation counter for new game (GlkOte starts at 1 after init)
          parchmentGeneration = 1;

          // Reset narration state
          pendingNarrationText = null;
          narrationChunks = [];
          currentChunkIndex = 0;
          isPaused = false;

          updateNavButtons();
          userInput.focus();
        } else if (event.type === 'line' || event.type === 'char') {
          // Handle user input events
          console.log('[Game] Input event:', event);
          vm.resume(event);
        } else if (event.type === 'specialresponse') {
          // Handle file operations
          console.log('[Game] Special response:', event);
          vm.resume(event);
        }
      }
    };

    // Verify gameport element exists
    const gameportEl = document.getElementById('gameport');
    if (!gameportEl) {
      throw new Error('Gameport element not found');
    }
    console.log('[ZVM] Gameport element found:', gameportEl);

    // Initialize GlkOte - it will use the global window.Game object
    // GlkOte will measure the gameport and call Game.accept() with init event
    console.log('[ZVM] Initializing GlkOte...');
    try {
      window.GlkOte.init();
      console.log('[ZVM] GlkOte.init() called successfully');
    } catch (error) {
      console.error('[ZVM] GlkOte.init() error:', error);
      throw error;
    }

  } catch (error) {
    console.error('[Game] Start error:', error);
    updateStatus('Error: ' + error.message);
  }
}

// Parchment command generation counter
let parchmentGeneration = 0;

// Send command directly to Parchment
async function sendCommandDirect(cmd) {
  const input = cmd !== undefined ? cmd : userInput.value;

  // Clear input immediately
  userInput.value = '';
  hasManualTyping = false;  // Reset flag after sending

  updateStatus('Sending...', 'processing');

  // Add to command history (no translation for direct send)
  // Show "[ENTER]" for empty commands
  addToCommandHistory(input || '[ENTER]');

  // Send command to Parchment via Game.accept()
  try {
    if (typeof Game !== 'undefined' && Game.accept) {
      // Send line input event to Parchment
      Game.accept({
        type: 'line',
        window: 1,  // Main window
        value: input,
        gen: parchmentGeneration++
      });

      console.log('[Parchment] Sent command:', input || '[ENTER]');
      updateStatus('Ready');
    } else {
      console.error('[Parchment] Game object not available');
      updateStatus('Error: Game not loaded');
    }
  } catch (error) {
    console.error('[Parchment] Error sending command:', error);
    updateStatus('Error: ' + error.message);
  }

  userInput.focus();
}

// Send command with AI translation
async function sendCommand() {
  const input = userInput.value;

  // Clear input immediately to prevent double-send
  userInput.value = '';
  hasManualTyping = false;  // Reset flag after sending

  // If empty, send directly as Enter command (no AI translation needed)
  if (!input || !input.trim()) {
    console.log('[Send] Empty input - sending Enter command');
    sendCommandDirect('');
    return;
  }

  updateStatus('Processing...', 'processing');

  // Show translating indicator in voice transcript
  voiceTranscript.textContent = '🤖 Translating...';
  voiceTranscript.classList.remove('confirmed', 'interim');
  voiceTranscript.classList.add('translating');

  // Request translation
  socket.emit('translate-command', input);

  // Wait for translation
  socket.once('command-translated', async (result) => {
    // Handle both old string format and new JSON format
    const command = typeof result === 'string' ? result : result.command;
    const confidence = typeof result === 'object' ? result.confidence : 100;
    const reasoning = typeof result === 'object' ? result.reasoning : '';

    // Clear translating indicator
    voiceTranscript.classList.remove('translating');
    voiceTranscript.textContent = 'Listening...';

    // Show translation with confidence indicator
    let displayText = '';
    if (command.toLowerCase() !== input.toLowerCase()) {
      displayText = `${input} → [${command}]`;
    } else {
      displayText = command;
    }

    // Add confidence warning if low
    if (confidence < 70) {
      displayText += ` ⚠️ (${confidence}% confident: ${reasoning})`;
      updateStatus(`⚠️ Low confidence translation - "${reasoning}"`);
    } else if (confidence < 90) {
      displayText += ` (${confidence}%)`;
    }

    addGameText(displayText, true);

    // Add to command history with translation and confidence
    addToCommandHistory(input, command, confidence);

    // Read back the translated command if it came from voice (not manual typing)
    if (!hasManualTyping) {
      speakAppMessage(command);
    }

    // Send translated command to Parchment
    try {
      if (typeof Game !== 'undefined' && Game.accept) {
        Game.accept({
          type: 'line',
          window: 1,
          value: command,
          gen: parchmentGeneration++
        });

        console.log('[Parchment] Sent translated command:', command);
        updateStatus('Ready');
      } else {
        console.error('[Parchment] Game object not available');
        updateStatus('Error: Game not loaded');
      }
    } catch (error) {
      console.error('[Parchment] Error sending translated command:', error);
      updateStatus('Error: ' + error.message);
    }

    // Note: Game output will be captured by GlkOte.update() hook
    userInput.focus();
  });
}

// Event Listeners
document.querySelectorAll('.game-card').forEach(card => {
  card.addEventListener('click', () => {
    const gamePath = card.dataset.game;
    startGame(gamePath);
  });
});

selectGameBtn.addEventListener('click', () => {
  // Show game selection (reload page)
  location.reload();
});

// Mode toggle handler (controls both text and voice)
modeToggle.addEventListener('change', () => {
  const isAIMode = modeToggle.checked;
  modeLabel.textContent = isAIMode ? 'AI Mode' : 'Direct';
  console.log('[Input Mode] Switched to:', isAIMode ? 'AI' : 'Direct');
});

// Send button - uses current mode
sendBtn.addEventListener('click', () => {
  const isAIMode = modeToggle.checked;
  if (isAIMode) {
    sendCommand();
  } else {
    sendCommandDirect();
  }
});

// Enter key - uses current mode
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const isAIMode = modeToggle.checked;
    if (isAIMode) {
      sendCommand();
    } else {
      sendCommandDirect();
    }
  } else {
    // Any other key = manual typing, don't auto-send on voice recognition end
    hasManualTyping = true;
  }
});

// Start voice meter
async function startVoiceMeter() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    microphone.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Update meter
    voiceMeterInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const percentage = Math.min(100, (average / 128) * 100);

      voiceMeterFill.style.width = percentage + '%';
    }, 50);

    console.log('[Voice Meter] Started');
  } catch (error) {
    console.error('[Voice Meter] Error:', error);
  }
}

// Stop voice meter
function stopVoiceMeter() {
  if (voiceMeterInterval) {
    clearInterval(voiceMeterInterval);
    voiceMeterInterval = null;
  }

  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  voiceMeterFill.style.width = '0%';
  console.log('[Voice Meter] Stopped');
}

// Toggle continuous voice listening
// Toggle Talk Mode (both listening AND narration)
toggleTalkModeBtn.addEventListener('click', async () => {
  if (!recognition) {
    updateStatus('Voice recognition not available');
    return;
  }

  if (talkModeActive) {
    // Stop talk mode (both listening and narration)
    talkModeActive = false;
    listeningEnabled = false;
    narrationEnabled = false;
    isListening = false;

    // Stop listening
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {}
    }

    stopVoiceMeter();
    voiceFeedback.classList.add('hidden');
    stopNarration();

    // Stop idle checker
    stopIdleChecker();

    // Clear voice history
    if (confirmedTranscriptTimeout) {
      clearTimeout(confirmedTranscriptTimeout);
      confirmedTranscriptTimeout = null;
    }
    voiceHistoryItems = [];
    voiceHistory.innerHTML = '';
    voiceTranscript.textContent = 'Listening...';
    voiceTranscript.classList.remove('interim', 'confirmed');

    // Hide voice panel
    voiceHistoryPanel.classList.add('hidden');

    // Hide mute button and navigation controls
    muteBtn.classList.add('hidden');
    document.querySelector('.narration-controls').classList.add('hidden');

    toggleTalkModeBtn.innerHTML = '🎤 Start Talk Mode';
    toggleTalkModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    updateStatus('Talk mode stopped');
  } else {
    // Start talk mode (both listening and narration)
    talkModeActive = true;
    listeningEnabled = true;
    narrationEnabled = true;

    // Start idle checker
    startIdleChecker();
    lastVoiceInputTime = Date.now();  // Reset timer

    // Auto-unmute mic when starting talk mode
    if (isMuted) {
      isMuted = false;
      muteBtn.innerHTML = '🔇 Mute Mic';
      muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    }

    // Show mute button and navigation controls
    muteBtn.classList.remove('hidden');
    document.querySelector('.narration-controls').classList.remove('hidden');

    // Show voice panel
    voiceHistoryPanel.classList.remove('hidden');

    toggleTalkModeBtn.innerHTML = '⏹️ Stop Talk Mode';
    toggleTalkModeBtn.style.background = 'rgba(245, 87, 108, 0.8)';

    updateStatus('🎤 Talk mode active - speak freely!');

    // Show voice feedback
    voiceFeedback.classList.remove('hidden');
    voiceTranscript.textContent = 'Listening...';

    // Start voice meter
    await startVoiceMeter();

    // Start recognition
    try {
      recognition.start();
    } catch (err) {
      console.error('[Voice] Start error:', err);
      updateStatus('Voice recognition failed');
      talkModeActive = false;
      toggleTalkModeBtn.innerHTML = '🎤 Start Talk Mode';
      voiceFeedback.classList.add('hidden');
      stopVoiceMeter();
      return;
    }

    // Start narration if there's pending text
    if (pendingNarrationText) {
      createNarrationChunks(pendingNarrationText);
      pendingNarrationText = null;
      await speakTextChunked(null, 0);
    }
  }
});

// Mute button (mutes microphone input, stops listening, keeps audio narration)
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;

  if (isMuted) {
    // Stop listening (mute mic)
    listeningEnabled = false;

    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {}
    }

    stopVoiceMeter();
    voiceFeedback.classList.add('hidden');

    muteBtn.innerHTML = '🎤 Unmute Mic';
    muteBtn.style.background = 'rgba(245, 87, 108, 0.8)';
    updateStatus('Microphone muted (narration continues)');
  } else {
    // Resume listening (unmute mic)
    listeningEnabled = true;

    voiceFeedback.classList.remove('hidden');
    voiceTranscript.textContent = 'Listening...';

    startVoiceMeter();

    if (recognition) {
      try {
        recognition.start();
      } catch (err) {
        console.error('[Voice] Resume error:', err);
      }
    }

    muteBtn.innerHTML = '🔇 Mute Mic';
    muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    updateStatus('Microphone active');
  }
});

// Navigation buttons
document.getElementById('skipToStartBtn').addEventListener('click', () => {
  skipToStart();
});

document.getElementById('prevChunkBtn').addEventListener('click', () => {
  skipToChunk(-1);
});

document.getElementById('nextChunkBtn').addEventListener('click', () => {
  skipToChunk(1);
});

document.getElementById('skipToEndBtn').addEventListener('click', () => {
  skipToEnd();
});

// Stop button
stopBtn.addEventListener('click', () => {
  console.log('[Control] Stop button clicked');
  stopNarration();
  narrationEnabled = false;
  isPaused = true;  // Set to paused (not playing)
  // DON'T clear narrationChunks - keep them so navigation still works
  currentChunkIndex = 0;  // Reset to beginning
  currentChunkStartTime = 0;  // Reset timestamp
  isNavigating = false;  // Reset navigation flag
  updateNavButtons();
  updateStatus('Narration stopped');

  // Remove highlighting from text
  if (currentGameTextElement) {
    const allSentences = currentGameTextElement.querySelectorAll('.sentence-chunk');
    allSentences.forEach(s => s.classList.remove('speaking'));
  }
});

// Pause/Play button
pausePlayBtn.addEventListener('click', () => {
  if (narrationChunks.length === 0) return;

  if (isPaused || !isNarrating) {
    // Play/Resume
    console.log('[Control] Play button clicked');
    isPaused = false;
    narrationEnabled = true;
    speakTextChunked(null, currentChunkIndex);
    updateStatus('Playing narration');
  } else {
    // Pause
    console.log('[Control] Pause button clicked');
    stopNarration();
    isPaused = true;
    updateNavButtons();
    updateStatus('Narration paused');

    // Keep highlighting to show where we're paused
    updateTextHighlight(currentChunkIndex);
  }
});

// Slider event handlers
narrationSlider.addEventListener('mousedown', () => {
  isUserScrubbing = true;
});

narrationSlider.addEventListener('mouseup', () => {
  isUserScrubbing = false;
  const newIndex = parseInt(narrationSlider.value);

  if (newIndex !== currentChunkIndex && !isNavigating) {
    console.log(`[Slider] Scrubbed to chunk ${newIndex}`);

    stopNarration();
    isPaused = false;  // Set to false so it will play
    narrationEnabled = true;  // Enable narration
    currentChunkIndex = newIndex;
    currentChunkStartTime = 0;  // Reset timestamp for smart back button
    updateNavButtons();

    // Always auto-play after scrubbing
    setTimeout(() => {
      speakTextChunked(null, newIndex);
    }, 100);
  }
});

narrationSlider.addEventListener('input', () => {
  // Update display while dragging
  if (isUserScrubbing) {
    const value = parseInt(narrationSlider.value);
    currentChunkLabel.textContent = `${value + 1} / ${narrationChunks.length}`;

    // Update text highlighting to show where we're scrubbing to
    updateTextHighlight(value);
  }
});

document.addEventListener('keydown', (e) => {
  // Alt = Push-to-talk (unmute mic while held)
  if (e.key === 'Alt' && !isPushToTalkActive && talkModeActive && document.activeElement !== userInput) {
    e.preventDefault();
    isPushToTalkActive = true;
    wasMutedBeforePTT = isMuted;

    // If muted, unmute temporarily
    if (isMuted) {
      isMuted = false;
      listeningEnabled = true;

      voiceFeedback.classList.remove('hidden');
      voiceTranscript.textContent = 'Push-to-talk active...';

      startVoiceMeter();

      if (recognition) {
        try {
          recognition.start();
        } catch (err) {
          console.error('[Voice] Push-to-talk start error:', err);
        }
      }

      muteBtn.innerHTML = '🔇 Mute Mic';
      muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      updateStatus('🎤 Push-to-talk active (hold Alt)');
    }
  }

  if (e.key === 'Escape' && talkModeActive) {
    toggleTalkModeBtn.click();  // Stop talk mode
  }

  // Arrow keys for navigation (when narration chunks exist)
  if (narrationChunks.length > 0) {
    if (e.key === 'ArrowLeft') {
      skipToChunk(-1);
    } else if (e.key === 'ArrowRight') {
      skipToChunk(1);
    }
  }

  // M key for mute toggle
  if (e.key === 'm' || e.key === 'M') {
    if (talkModeActive && !e.ctrlKey && document.activeElement !== userInput) {
      muteBtn.click();
    }
  }
});

// Alt key release - restore mute state after push-to-talk
document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt' && isPushToTalkActive) {
    isPushToTalkActive = false;

    // Restore previous mute state
    if (wasMutedBeforePTT) {
      isMuted = true;
      listeningEnabled = false;

      if (recognition) {
        try {
          recognition.stop();
        } catch (err) {}
      }

      stopVoiceMeter();
      voiceFeedback.classList.add('hidden');

      muteBtn.innerHTML = '🎤 Unmute Mic';
      muteBtn.style.background = 'rgba(245, 87, 108, 0.8)';
      updateStatus('Microphone muted (narration continues)');
    } else {
      updateStatus('Microphone active');
    }
  }
});

// Socket handlers
socket.on('error', (message) => {
  updateStatus('Error: ' + message);
  console.error('[Server Error]:', message);
});

socket.on('game-ended', (code) => {
  updateStatus('Game ended');
  addGameText('\n--- Game Ended ---\n');
});

// Settings Panel Management
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const pronunciationList = document.getElementById('pronunciationList');
const newWordInput = document.getElementById('newWord');
const newPronunciationInput = document.getElementById('newPronunciation');
const addPronunciationBtn = document.getElementById('addPronunciationBtn');

function renderPronunciationList() {
  const map = getPronunciationMap();
  pronunciationList.innerHTML = '';

  Object.entries(map).forEach(([word, pronunciation]) => {
    const item = document.createElement('div');
    item.className = 'pronunciation-item';

    item.innerHTML = `
      <div class="pronunciation-word">${word}</div>
      <div class="pronunciation-arrow">→</div>
      <div class="pronunciation-says">${pronunciation}</div>
      <button class="pronunciation-delete" data-word="${word}">✕</button>
    `;

    pronunciationList.appendChild(item);
  });

  // Add delete handlers
  pronunciationList.querySelectorAll('.pronunciation-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.getAttribute('data-word');
      const map = getPronunciationMap();
      delete map[word];
      savePronunciationMap(map);
      renderPronunciationList();
    });
  });
}

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
  settingsPanel.classList.add('open');
  renderPronunciationList();
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
  setTimeout(() => {
    settingsPanel.classList.add('hidden');
  }, 300);
});

addPronunciationBtn.addEventListener('click', () => {
  const word = newWordInput.value.trim();
  const pronunciation = newPronunciationInput.value.trim();

  if (word && pronunciation) {
    const map = getPronunciationMap();
    map[word] = pronunciation;
    savePronunciationMap(map);
    renderPronunciationList();

    newWordInput.value = '';
    newPronunciationInput.value = '';
    newWordInput.focus();
  }
});

// Allow Enter key to add pronunciation
newPronunciationInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addPronunciationBtn.click();
  }
});

// History Collapse/Expand Functionality
const commandHistoryToggle = document.getElementById('commandHistoryToggle');
const commandHistoryEl = document.getElementById('commandHistory');

// Load saved state from localStorage
function loadHistoryState() {
  const voiceExpanded = localStorage.getItem('voiceHistoryExpanded') === 'true';
  const commandExpanded = localStorage.getItem('commandHistoryExpanded') === 'true';

  if (voiceExpanded) {
    voiceHistoryToggle.classList.add('expanded');
    voiceHistoryEl.classList.add('expanded');
    voiceHistoryToggle.querySelector('.expand-text').textContent = 'Show Less';
  }

  if (commandExpanded) {
    commandHistoryToggle.classList.add('expanded');
    commandHistoryEl.classList.add('expanded');
    commandHistoryToggle.querySelector('.expand-text').textContent = 'Show Less';
  }
}

// Toggle voice history
voiceHistoryToggle.addEventListener('click', () => {
  const isExpanded = voiceHistoryToggle.classList.toggle('expanded');
  voiceHistoryEl.classList.toggle('expanded');
  voiceHistoryToggle.querySelector('.expand-text').textContent = isExpanded ? 'Show Less' : 'Show More';
  localStorage.setItem('voiceHistoryExpanded', isExpanded);
  console.log('[History] Voice history', isExpanded ? 'expanded' : 'compact');

  // Update UI to show correct number of items
  updateVoiceHistoryUI();
});

// Toggle command history
commandHistoryToggle.addEventListener('click', () => {
  const isExpanded = commandHistoryToggle.classList.toggle('expanded');
  commandHistoryEl.classList.toggle('expanded');
  commandHistoryToggle.querySelector('.expand-text').textContent = isExpanded ? 'Show Less' : 'Show More';
  localStorage.setItem('commandHistoryExpanded', isExpanded);
  console.log('[History] Command history', isExpanded ? 'expanded' : 'compact');
});

// Initialize
// Load voice configuration
loadBrowserVoiceConfig();

initVoiceRecognition();

// Load history collapse state
loadHistoryState();

console.log('[App] Initialized');

// Hook into ZVM's output for TTS capture
// Wait for ZVM to load
window.addEventListener('load', () => {
  // Give Parchment time to initialize
  setTimeout(() => {
    if (typeof GlkOte !== 'undefined' && GlkOte.update) {
      console.log('[Parchment] Hooking GlkOte.update for TTS capture');

      // Save original update function
      const originalUpdate = GlkOte.update;

      // Wrap update to capture text output
      GlkOte.update = function(updateObj) {
        try {
          // Extract text from content structure
          if (updateObj && updateObj.content) {
            let capturedText = '';

            updateObj.content.forEach(windowContent => {
              if (windowContent.text) {
                windowContent.text.forEach(textBlock => {
                  if (textBlock.content) {
                    textBlock.content.forEach(run => {
                      // Check different possible text formats
                      if (typeof run === 'string') {
                        capturedText += run;
                      } else if (Array.isArray(run) && run.length >= 2) {
                        // Format: ['style', 'text']
                        capturedText += run[1] || '';
                      } else if (run.text) {
                        capturedText += run.text;
                      }
                    });
                  }
                });
              }
            });

            // If we captured text, handle it for TTS
            if (capturedText.trim()) {
              console.log('[Parchment] Captured output:', capturedText.substring(0, 100) + '...');
              handleParchmentOutput(capturedText);
            }
          }
        } catch (error) {
          console.error('[Parchment] Error capturing output:', error);
        }

        // Call original update to render
        return originalUpdate.call(this, updateObj);
      };

      console.log('[Parchment] Output capture hook installed');
    } else {
      console.warn('[Parchment] GlkOte not found - output capture disabled');
    }
  }, 1000);
});

// Handle captured output from Parchment
function handleParchmentOutput(text) {
  // Store for potential narration
  pendingNarrationText = text;

  // If talk mode is active, auto-narrate
  if (narrationEnabled && !isNarrating) {
    speakTextChunked(text);
  }
}

// Highlight text being spoken for visual feedback
function highlightSpokenText(text) {
  try {
    // GlkOte outputs to #gameport with various content divs
    const gameOutput = document.querySelector('#gameport .TextBuffer, #gameport #window0, #gameport');
    if (!gameOutput) return;

    // Find and wrap spoken text with highlight class
    const walker = document.createTreeWalker(
      gameOutput,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    // Search for matching text and add highlight
    textNodes.forEach(node => {
      if (node.textContent.includes(text.substring(0, 50))) {
        const span = document.createElement('span');
        span.className = 'tts-highlight';
        span.textContent = node.textContent;
        node.parentNode.replaceChild(span, node);
      }
    });

  } catch (error) {
    console.error('[TTS] Highlight error:', error);
  }
}

// Remove highlight when done
function removeHighlight() {
  const highlights = document.querySelectorAll('.tts-highlight');
  highlights.forEach(span => {
    span.classList.remove('tts-highlight');
  });
}
