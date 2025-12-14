// Connect to server via Socket.IO
const socket = io();

// DOM Elements
const welcome = document.getElementById('welcome');
const gameOutput = document.getElementById('gameOutput');
const gameOutputInner = document.getElementById('gameOutputInner');
const inputArea = document.getElementById('inputArea');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const selectGameBtn = document.getElementById('selectGameBtn');
const status = document.getElementById('status');
const muteBtn = document.getElementById('muteBtn');
const voiceSelect = document.getElementById('voiceSelect');
const appVoiceSelect = document.getElementById('appVoiceSelect');
const testAppVoiceBtn = document.getElementById('testAppVoiceBtn');
const voiceFeedback = document.getElementById('voiceFeedback');
const voiceIndicator = document.getElementById('voiceIndicator');
const voiceTranscript = document.getElementById('voiceTranscript');
const voicePanel = document.querySelector('.voice-panel');
const lastHeard = document.getElementById('lastHeard');
const lastResponse = document.getElementById('lastResponse');
const voiceHistoryBtn = document.getElementById('voiceHistoryBtn');
const commandHistoryBtn = document.getElementById('commandHistoryBtn');
const pausePlayBtn = document.getElementById('pausePlayBtn');
const autoplayBtn = document.getElementById('autoplayBtn');

// State
let currentGamePath = null;
let isListening = false;
let listeningEnabled = false;  // Continuous listening mode
let recognition = null;
let isRecognitionActive = false;  // Track if recognition is actually running
let currentAudio = null;
let narrationEnabled = false;
let isMuted = false;  // Mute MICROPHONE input (audio output still plays)
let autoplayEnabled = true;  // Auto-play new game text (can be toggled)
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
let ttsIsSpeaking = false;  // Track when TTS is actively speaking (to pause recognition)
let appVoicePromise = null;  // Promise that resolves when app voice finishes speaking
let soundDetected = false;  // Track if sound above threshold is detected
let pausedForSound = false;  // Track if narration was paused due to sound detection
let soundPauseTimeout = null;  // Timeout to resume after silence
let pendingCommandProcessed = false;  // Track if a command was processed during sound pause
const SOUND_THRESHOLD = 30;  // Audio level threshold (0-100) to trigger pause
const SILENCE_DELAY = 800;  // ms of silence before resuming narration

// Voice/command history arrays (for history popup)
let voiceHistoryItems = [];  // {text, isNavCommand}
let commandHistoryItems = [];  // {original, translated, confidence}
let lastHeardClearTimeout = null;  // Timeout to clear lastHeard after 5 seconds
let transcriptResetTimeout = null;  // Timeout to reset voice transcript to "Listening..."

// Update the last heard text in voice panel
function updateLastHeard(text, isNavCommand = false) {
  if (lastHeard) {
    lastHeard.textContent = text;
    lastHeard.className = 'last-heard' + (isNavCommand ? ' nav-command' : '');

    // Clear after 5 seconds
    if (lastHeardClearTimeout) clearTimeout(lastHeardClearTimeout);
    lastHeardClearTimeout = setTimeout(() => {
      lastHeard.textContent = '';
    }, 5000);
  }
  // Add to history array
  voiceHistoryItems.unshift({ text, isNavCommand });
  if (voiceHistoryItems.length > 20) voiceHistoryItems.pop();
}

// Update the last app response in voice panel
function updateLastResponse(text) {
  if (lastResponse) {
    lastResponse.textContent = text;
  }
}

// Show confirmed transcript then reset to Listening after 5 seconds
function showConfirmedTranscript(text, isNavCommand = false) {
  // Clear any pending reset
  if (transcriptResetTimeout) {
    clearTimeout(transcriptResetTimeout);
  }

  voiceTranscript.textContent = text;
  voiceTranscript.classList.remove('interim');
  voiceTranscript.classList.add('confirmed');
  if (isNavCommand) {
    voiceTranscript.classList.add('nav-command');
  } else {
    voiceTranscript.classList.remove('nav-command');
  }

  // Also update lastHeard for history
  updateLastHeard(text, isNavCommand);

  // Reset transcript to "Listening..." after 5 seconds
  transcriptResetTimeout = setTimeout(() => {
    voiceTranscript.textContent = 'Listening...';
    voiceTranscript.classList.remove('confirmed', 'nav-command');
  }, 5000);
}

// Add to command history (for history popup)
function addToCommandHistory(original, translated = null, confidence = null) {
  commandHistoryItems.unshift({ original, translated, confidence });
  if (commandHistoryItems.length > 20) commandHistoryItems.pop();
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
    isRecognitionActive = true;
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
    isRecognitionActive = false;
  };

  recognition.onend = () => {
    isListening = false;
    isRecognitionActive = false;

    // Only auto-send if we haven't already processed this session AND user hasn't manually typed
    const hasInput = userInput.value && userInput.value.trim();
    // Allow sending if narration is paused for sound (user spoke to give a command)
    const canSendDuringNarration = pausedForSound;

    if (hasInput && (!isNarrating || canSendDuringNarration) && !hasProcessedResult && !hasManualTyping) {
      console.log('[Voice] OnEnd: Auto-sending:', userInput.value);
      hasProcessedResult = true;  // Mark as processed
      sendCommand();
    } else if (hasProcessedResult) {
      console.log('[Voice] OnEnd: Already processed, skipping auto-send');
    } else if (hasManualTyping) {
      console.log('[Voice] OnEnd: Manual typing detected, waiting for Enter key');
    } else if (isNarrating && !canSendDuringNarration) {
      console.log('[Voice] OnEnd: Narrating, keeping input buffered');
    } else {
      console.log('[Voice] OnEnd: No input to send');
    }

    // ALWAYS restart listening if continuous mode enabled (but not during TTS)
    if (listeningEnabled && !ttsIsSpeaking) {
      console.log('[Voice] Restarting in 300ms...');
      setTimeout(() => {
        if (listeningEnabled && !ttsIsSpeaking && !isRecognitionActive) {
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
        } else if (ttsIsSpeaking) {
          console.log('[Voice] Not restarting - TTS is speaking');
        }
      }, 300);
    } else if (ttsIsSpeaking) {
      console.log('[Voice] Not restarting - TTS is speaking');
    }
  };
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
  // Helper to mark command as processed (prevents sound-pause auto-resume)
  const markCommandProcessed = () => {
    pendingCommandProcessed = true;
    pausedForSound = false;
  };

  // Restart - Go to beginning
  if (lower === 'restart') {
    console.log('[Voice Command] RESTART - go to beginning');
    markCommandProcessed();
    skipToStart();
    return false;
  }

  // Back - Previous sentence
  if (lower === 'back') {
    console.log('[Voice Command] BACK - previous sentence');
    markCommandProcessed();
    skipToChunk(-1);
    return false;
  }

  // Stop - Pause narration (same as pause)
  if (lower === 'stop') {
    console.log('[Voice Command] STOP - pausing narration');
    markCommandProcessed();
    if (isNarrating) {
      narrationEnabled = false;
      isPaused = true;
      stopNarration();
      updateStatus('Narration paused');
    }
    return false;
  }

  // Pause - Pause narration
  if (lower === 'pause') {
    console.log('[Voice Command] PAUSE');
    markCommandProcessed();
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
    markCommandProcessed();
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
    markCommandProcessed();
    skipToChunk(1);
    return false;
  }

  // Skip All - Skip to end (various phrasings)
  if (lower === 'skip all' || lower === 'skip to end' || lower === 'skip to the end' || lower === 'end') {
    console.log('[Voice Command] SKIP TO END');
    markCommandProcessed();
    skipToEnd();
    return false;
  }

  // During narration, ignore all non-navigation commands (unless paused for sound input)
  if (isNarrating && !pausedForSound) {
    console.log('[Voice] Ignored during narration:', transcript);
    updateStatus('🔊 Narrating... Use navigation commands');
    return false;
  }

  // GAME COMMANDS (sent to IF parser via AI translation)

  // "Next" or "Enter" or "More" or "Continue" - Send empty command (press Enter)
  if (lower === 'next' || lower === 'enter' || lower === 'more' || lower === 'continue') {
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

  // Regular command - read back and return for AI translation
  console.log('[Voice] Will translate:', transcript);
  speakAppMessage(transcript);  // Read back what we heard
  return transcript;
}

// Speak feedback using app voice (for confirmations, not narration)
// Returns a promise that resolves when speech is done
function speakAppMessage(text) {
  if (!('speechSynthesis' in window) || !text) return Promise.resolve();

  appVoicePromise = new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const appVoice = voices.find(v => v.name === browserVoiceConfig.appVoice);

    if (appVoice) {
      utterance.voice = appVoice;
    }

    utterance.rate = 1.3;  // Faster for quick confirmations
    utterance.pitch = 1.0;
    utterance.volume = 0.8;  // Slightly quieter than narration

    utterance.onend = () => {
      console.log('[App Voice] Finished speaking');
      appVoicePromise = null;
      resolve();
    };

    utterance.onerror = () => {
      appVoicePromise = null;
      resolve();
    };

    speechSynthesis.speak(utterance);
    console.log('[App Voice] Speaking:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  });

  return appVoicePromise;
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
    // Convert <br> tags to newlines BEFORE extracting plain text
    const tempDiv = document.createElement('div');
    const textWithNewlines = text.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = textWithNewlines;
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

  gameOutputInner.appendChild(div);

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
// Note: isMuted is for MICROPHONE only, not audio output
async function playAudio(audioDataOrText) {
  if (!audioDataOrText || !narrationEnabled) {
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

  utterance.rate = 1.0;  // Use default rate for app voice
  utterance.pitch = 1.0;

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
      ttsIsSpeaking = false;
      updateStatus('Ready');
      updateNavButtons();  // Update pause/play button icon
      // Resume recognition if listening was enabled
      if (listeningEnabled && recognition && !isMuted && !isRecognitionActive) {
        try {
          recognition.start();
          console.log('[Voice] Resumed recognition after TTS');
        } catch (err) {
          // Ignore if already started
        }
      }
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
      ttsIsSpeaking = false;
      updateNavButtons();  // Update pause/play button icon
      // Resume recognition if listening was enabled
      if (listeningEnabled && recognition && !isMuted && !isRecognitionActive) {
        try {
          recognition.start();
          console.log('[Voice] Resumed recognition after TTS error');
        } catch (err) {
          // Ignore if already started
        }
      }
      resolve();
    };

    // Stop any current speech
    speechSynthesis.cancel();

    // Pause recognition while TTS is speaking to avoid picking up our own audio
    ttsIsSpeaking = true;
    if (recognition && listeningEnabled) {
      try {
        recognition.stop();
        console.log('[Voice] Paused recognition during TTS');
      } catch (err) {
        // Ignore if not started
      }
    }

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
  // Server sends <br><br> for paragraphs, single newlines converted to spaces
  const tempDiv = document.createElement('div');
  // Add pause markers for TTS before stripping HTML
  let htmlForTTS = text
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')  // Paragraph breaks -> sentence break
    .replace(/<br\s*\/?>/gi, ' ')                 // Single line breaks -> space
    .replace(/<span class="soft-break"><\/span>/gi, ' ');  // Soft breaks -> space
  tempDiv.innerHTML = htmlForTTS;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';

  // Pre-process text to normalize before chunking (for TTS)
  let processedText = plainText
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

  // For display: use original server HTML (preserves formatting)
  if (currentGameTextElement) {
    currentGameTextElement.innerHTML = text;
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

  // Wait for app voice to finish before starting narration
  if (appVoicePromise) {
    console.log('[TTS] Waiting for app voice to finish...');
    await appVoicePromise;
    console.log('[TTS] App voice finished, starting narration');
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
      await playAudio(audioData);
    }
  }

  // Finished all chunks
  if (currentChunkIndex >= narrationChunks.length - 1 && narrationEnabled && !isPaused) {
    console.log('[TTS] Narration complete - resetting to start');

    // Reset to beginning so play restarts from start
    currentChunkIndex = 0;
    narrationEnabled = false;
    isPaused = true;
    isNarrating = false;

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
    updateStatus('Ready');
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

  // Log position for debugging
  if (narrationChunks.length > 0) {
    console.log('[Nav] Position:', `(${currentChunkIndex + 1}/${narrationChunks.length})`);
  }
}

// Start game
async function startGame(gamePath) {
  try {
    currentGamePath = gamePath;

    updateStatus('Starting game...', 'processing');

    // Hide welcome, show input
    welcome.classList.add('hidden');
    inputArea.classList.remove('hidden');

    // Request game start
    socket.emit('start-game', gamePath);

    // Wait for initial output
    socket.once('game-output', (output) => {
      gameOutputInner.innerHTML = '';

      // Stop any existing narration (in case restarting game)
      stopNarration();

      // Store the game text element reference
      currentGameTextElement = addGameText(output);

      // Reset narration state for new game
      pendingNarrationText = output;
      narrationChunks = [];
      currentChunkIndex = 0;
      isPaused = false;

      // Create narration chunks so play button works
      createNarrationChunks(output);
      updateNavButtons();

      // Auto-start talk mode
      startTalkMode();
      userInput.focus();
    });

  } catch (error) {
    console.error('[Game] Start error:', error);
    updateStatus('Error: ' + error.message);
  }
}

// Send command directly
async function sendCommandDirect(cmd) {
  const input = cmd !== undefined ? cmd : userInput.value;

  // Mark that a command is being processed (prevents sound-pause resume)
  pendingCommandProcessed = true;
  pausedForSound = false;

  // Clear input immediately
  userInput.value = '';
  hasManualTyping = false;  // Reset flag after sending

  updateStatus('Sending...', 'processing');

  // Show command (empty shows as gray [ENTER])
  addGameText(input, true);

  // Add to command history (no translation for direct send)
  // Show "[ENTER]" for empty commands
  addToCommandHistory(input || '[ENTER]');

  // Send to server
  socket.emit('send-command', input);

  // Wait for response
  socket.once('game-output', async (output) => {
    if (output && output.trim()) {
      // Stop any currently running narration cleanly before processing new output
      stopNarration();

      // Store the game text element reference
      currentGameTextElement = addGameText(output);

      // Reset narration for new text
      pendingNarrationText = output;
      narrationChunks = [];  // Clear old chunks
      currentChunkIndex = 0;
      isPaused = false;

      // ALWAYS create narration chunks (even if not auto-playing)
      // This ensures navigation buttons work properly
      createNarrationChunks(output);

      // Auto-narrate if autoplay is enabled and we're in talk mode
      if (autoplayEnabled && talkModeActive) {
        narrationEnabled = true;  // Re-enable for new text
        await speakTextChunked(null, 0);  // Play from chunks
      }

      updateNavButtons();
    }

    updateStatus('Ready');
    userInput.focus();
  });
}

// Send command (direct mode - no AI translation)
async function sendCommand() {
  const input = userInput.value;

  // Mark that a command is being processed (prevents sound-pause resume)
  pendingCommandProcessed = true;
  pausedForSound = false;

  // Clear input immediately to prevent double-send
  userInput.value = '';
  hasManualTyping = false;  // Reset flag after sending

  // Send directly without AI translation
  sendCommandDirect(input || '');
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

// Send button
sendBtn.addEventListener('click', () => {
  sendCommand();
});

// Enter key
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendCommand();
  } else {
    // Any other key = manual typing, don't auto-send on voice recognition end
    hasManualTyping = true;
  }
});

// Click on game output focuses text input (but not when selecting text)
gameOutput.addEventListener('click', () => {
  userInput.focus();
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

    // Update meter and detect sound for pause/resume
    voiceMeterInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const percentage = Math.min(100, (average / 128) * 100);

      // Update dot indicator (green if > 20%, maroon otherwise)
      if (percentage > 20) {
        voiceIndicator.classList.add('active');
      } else {
        voiceIndicator.classList.remove('active');
      }

      // Sound detection for auto-pause narration
      if (percentage > SOUND_THRESHOLD) {
        // Sound detected above threshold
        if (!soundDetected) {
          soundDetected = true;
          console.log('[Sound] Detected above threshold:', percentage.toFixed(1) + '%');

          // Pause narration if it's playing
          if (isNarrating && !pausedForSound && !isMuted) {
            pausedForSound = true;
            pendingCommandProcessed = false;
            speechSynthesis.pause();
            console.log('[Sound] Paused narration for voice input');
          }
        }

        // Clear any pending resume timeout
        if (soundPauseTimeout) {
          clearTimeout(soundPauseTimeout);
          soundPauseTimeout = null;
        }
      } else {
        // Sound below threshold (silence)
        if (soundDetected) {
          soundDetected = false;

          // Start timeout to resume narration after silence
          if (pausedForSound && !soundPauseTimeout) {
            soundPauseTimeout = setTimeout(() => {
              soundPauseTimeout = null;

              // Only resume if no command was processed and still paused for sound
              if (pausedForSound && !pendingCommandProcessed) {
                pausedForSound = false;
                if (narrationEnabled && !isPaused) {
                  speechSynthesis.resume();
                  console.log('[Sound] Resumed narration after silence (no command)');
                }
              } else if (pendingCommandProcessed) {
                console.log('[Sound] Not resuming - command was processed');
                pausedForSound = false;
              }
            }, SILENCE_DELAY);
          }
        }
      }
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

  if (soundPauseTimeout) {
    clearTimeout(soundPauseTimeout);
    soundPauseTimeout = null;
  }

  // Reset sound detection state
  soundDetected = false;
  pausedForSound = false;

  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  voiceIndicator.classList.remove('active');
  console.log('[Voice Meter] Stopped');
}

// Start Talk Mode (both listening AND narration) - auto-started when game begins
async function startTalkMode() {
  if (!recognition) {
    updateStatus('Voice recognition not available');
    return;
  }

  talkModeActive = true;
  listeningEnabled = true;
  narrationEnabled = true;

  // Unmute mic
  isMuted = false;
  const icon = muteBtn.querySelector('.material-icons');
  if (icon) icon.textContent = 'mic';
  muteBtn.classList.remove('muted');

  // Show voice panel and feedback
  voicePanel.classList.add('active');
  voiceFeedback.classList.remove('hidden');
  voiceTranscript.textContent = 'Listening...';

  updateStatus('🎤 Listening...');

  // Start voice meter
  await startVoiceMeter();

  // Start recognition (only if not already running)
  if (!isRecognitionActive) {
    try {
      recognition.start();
    } catch (err) {
      console.error('[Voice] Start error:', err);
      updateStatus('Voice recognition failed');
      talkModeActive = false;
      voiceFeedback.classList.add('hidden');
      voicePanel.classList.remove('active');
      stopVoiceMeter();
      return;
    }
  }

  // Start narration if there's pending text or existing chunks
  if (pendingNarrationText) {
    createNarrationChunks(pendingNarrationText);
    pendingNarrationText = null;
    await speakTextChunked(null, 0);
  } else if (narrationChunks.length > 0) {
    console.log('[TTS] Starting narration from existing chunks:', narrationChunks.length);
    await speakTextChunked(null, 0);
  }
}

// Mute button (mutes microphone input, stops listening, keeps audio narration)
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  const icon = muteBtn.querySelector('.material-icons');

  if (isMuted) {
    // Stop listening (mute mic)
    listeningEnabled = false;

    if (recognition) {
      try {
        recognition.stop();
        isRecognitionActive = false;  // Force reset in case onend doesn't fire immediately
      } catch (err) {}
    }

    stopVoiceMeter();

    // Update voice indicator to muted state
    voiceIndicator.classList.remove('active');
    voiceIndicator.classList.add('muted');
    voiceTranscript.textContent = 'Muted';

    if (icon) icon.textContent = 'mic_off';
    muteBtn.classList.add('muted');
    updateStatus('Microphone muted');
  } else {
    // Resume listening (unmute mic)
    listeningEnabled = true;

    voiceFeedback.classList.remove('hidden');

    // Update voice indicator to listening state
    voiceIndicator.classList.remove('muted');
    voiceTranscript.textContent = 'Listening...';

    startVoiceMeter();

    if (recognition && !isRecognitionActive) {
      try {
        recognition.start();
      } catch (err) {
        console.error('[Voice] Resume error:', err);
      }
    }

    if (icon) icon.textContent = 'mic';
    muteBtn.classList.remove('muted');
    updateStatus('Microphone active');
  }
});

// Autoplay toggle button
autoplayBtn.addEventListener('click', () => {
  autoplayEnabled = !autoplayEnabled;
  const icon = autoplayBtn.querySelector('.material-icons');

  if (autoplayEnabled) {
    autoplayBtn.classList.add('active');
    if (icon) icon.textContent = 'play_circle';
    updateStatus('Auto-play enabled');
  } else {
    autoplayBtn.classList.remove('active');
    if (icon) icon.textContent = 'play_disabled';
    updateStatus('Auto-play disabled');
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

      if (recognition && !isRecognitionActive) {
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

  // Escape stops current narration
  if (e.key === 'Escape' && isNarrating) {
    stopNarration();
    isPaused = true;
    updateNavButtons();
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
          isRecognitionActive = false;  // Force reset in case onend doesn't fire immediately
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

// History buttons (open popup - TODO: implement popup)
if (voiceHistoryBtn) {
  voiceHistoryBtn.addEventListener('click', () => {
    console.log('[History] Voice history button clicked');
    alert('Voice history:\n' + voiceHistoryItems.map(i => i.text).join('\n'));
  });
}

if (commandHistoryBtn) {
  commandHistoryBtn.addEventListener('click', () => {
    console.log('[History] Command history button clicked');
    alert('Command history:\n' + commandHistoryItems.map(i => i.original + (i.translated ? ' → ' + i.translated : '')).join('\n'));
  });
}

// Initialize
loadBrowserVoiceConfig();
initVoiceRecognition();

console.log('[App] Initialized');
