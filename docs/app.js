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
let currentGameTextElement = null;  // Track the current game-text element for highlighting
let pendingCommandProcessed = false;  // Track if a command was processed during sound pause
let narrationSessionId = 0;  // Unique ID for each narration session - used to kill old async loops
const SOUND_THRESHOLD = 60;  // Audio level threshold (0-100) to trigger pause
const SILENCE_DELAY = 800;  // ms of silence before resuming narration

// Echo detection - recently spoken TTS text for fingerprinting
let recentlySpokenChunks = [];  // Array of {text, timestamp}
const ECHO_CHUNK_RETENTION_MS = 5000;  // Keep chunks for 5 seconds
const ECHO_SIMILARITY_THRESHOLD = 0.5;  // 50% similarity = echo (lowered for better detection)
const VOICE_CONFIDENCE_THRESHOLD = 0.5;  // Reject voice input below 50% confidence

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

  // Reset transcript after 5 seconds
  transcriptResetTimeout = setTimeout(() => {
    voiceTranscript.textContent = isMuted ? 'Muted' : 'Listening...';
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

    // Show live transcript (but not when muted - keep "Muted" visible)
    if (interimTranscript && !isMuted) {
      // Cancel any pending confirmed transition
      if (confirmedTranscriptTimeout) {
        clearTimeout(confirmedTranscriptTimeout);
        confirmedTranscriptTimeout = null;
      }

      // During narration, filter echo from interim transcripts
      try {
        if (isNarrating && isEchoOfSpokenText(interimTranscript)) {
          // Don't show - likely echo
          return;
        }
      } catch (e) {
        console.error('[Voice] Echo detection error (interim):', e);
        // Continue processing even if echo detection fails
      }
      voiceTranscript.textContent = interimTranscript;
      voiceTranscript.classList.remove('confirmed');
      voiceTranscript.classList.add('interim');
      console.log('[Voice] Interim:', interimTranscript);
    }

    // Process final result
    if (finalTranscript && !hasProcessedResult) {
      console.log('[Voice] Final:', finalTranscript);

      // Check for echo - discard if matches recent TTS output
      try {
        if (isEchoOfSpokenText(finalTranscript)) {
          console.log('[Voice] Discarding echo:', finalTranscript);
          voiceTranscript.textContent = isMuted ? 'Muted' : 'Listening...';
          voiceTranscript.classList.remove('interim', 'confirmed');
          return;
        }
      } catch (e) {
        console.error('[Voice] Echo detection error (final):', e);
        // Continue processing even if echo detection fails
      }

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
    } else if (event.error === 'aborted') {
      // Aborted during TTS or restart - expected behavior, ignore silently
      return;
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
              voiceTranscript.textContent = isMuted ? 'Muted' : 'Listening...';
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

  // When muted, only respond to "unmute" command
  if (isMuted) {
    console.log('[Voice] Muted mode - checking for unmute. Heard:', lower);
    if (lower === 'unmute' || lower === 'on mute' || lower === 'un mute') {
      console.log('[Voice Command] UNMUTE (while muted)');
      markCommandProcessed();
      isMuted = false;
      const icon = muteBtn.querySelector('.material-icons');
      if (icon) icon.textContent = 'mic';
      muteBtn.classList.remove('muted');
      voicePanel.classList.remove('muted');
      voiceFeedback.classList.remove('hidden');
      voiceTranscript.textContent = 'Listening...';
      startVoiceMeter();
      updateStatus('Microphone unmuted');
      return false;
    }
    // Ignore all other commands while muted
    console.log('[Voice] Ignored while muted:', transcript);
    return false;
  }

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
    if (!narrationEnabled && (isPaused || narrationChunks.length > 0)) {
      narrationEnabled = true;
      isPaused = false;
      pendingNarrationText = null;  // Clear pending flag

      // Resume from current position (chunks already created by addGameText)
      speakTextChunked(null, currentChunkIndex);
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

  // Unmute - Resume listening (works even while muted!)
  if (lower === 'unmute' || lower === 'on mute' || lower === 'un mute') {
    console.log('[Voice Command] UNMUTE');
    markCommandProcessed();
    if (isMuted) {
      isMuted = false;
      const icon = muteBtn.querySelector('.material-icons');
      if (icon) icon.textContent = 'mic';
      muteBtn.classList.remove('muted');
      updateStatus('Microphone unmuted');
    }
    return false;
  }

  // Mute - Stop listening
  if (lower === 'mute') {
    console.log('[Voice Command] MUTE');
    markCommandProcessed();
    if (!isMuted) {
      isMuted = true;
      const icon = muteBtn.querySelector('.material-icons');
      if (icon) icon.textContent = 'mic_off';
      muteBtn.classList.add('muted');
      updateStatus('Microphone muted');
    }
    return false;
  }

  // SAVE/RESTORE Commands (work anytime, bypass AI translation)
  // "load game" / "restore game" - Restore from most recent save
  if (lower === 'load game' || lower === 'restore game' || lower === 'load' || lower === 'restore') {
    console.log('[Voice Command] RESTORE LATEST');
    markCommandProcessed();
    restoreLatest();
    return false;
  }

  // "load slot N" / "restore slot N" - Restore from specific slot
  const loadSlotMatch = lower.match(/^(?:load|restore)\s+slot\s+(\d+)$/);
  if (loadSlotMatch) {
    const slot = parseInt(loadSlotMatch[1]);
    console.log('[Voice Command] RESTORE SLOT', slot);
    markCommandProcessed();
    restoreFromSlot(slot);
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
    div.className = 'game-text';

    // IMPORTANT: Stop any active narration before replacing chunks
    // This prevents race conditions when new text arrives mid-narration
    if (isNarrating) {
      console.log('[TTS] New text arriving - stopping current narration');
      stopNarration();
      currentChunkIndex = 0;
      currentChunkStartTime = 0;
    }

    // TEMPORARY MARKER SYSTEM (System 1)
    // Step 1: Insert temporary markers (⚐N⚐) at all potential chunk boundaries
    const markedHTML = insertTemporaryMarkers(text);

    // Step 2: Set HTML with markers
    div.innerHTML = markedHTML;

    // Step 3: Create narration chunks and extract which markers survived
    const chunksWithMarkers = createNarrationChunks(markedHTML);
    narrationChunks = chunksWithMarkers.map(c => c.text);
    const survivingMarkerIDs = chunksWithMarkers.map(c => c.markerID).filter(id => id !== null);
    console.log('[TTS] Created', narrationChunks.length, 'chunks for narration');

    // Step 4: Replace surviving temp markers with real DOM span elements
    insertRealMarkersAtIDs(div, survivingMarkerIDs);

    // Step 5: Insert start marker for chunk 0 at the very beginning
    if (div.firstChild) {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = 0;
      startMarker.style.cssText = 'display: none; position: absolute;';
      div.insertBefore(startMarker, div.firstChild);
      console.log('[Markers] Inserted start marker for chunk 0 at beginning');
    }

    // Step 6: Clean up any remaining temporary markers
    removeTemporaryMarkers(div, narrationChunks);
  }

  gameOutputInner.appendChild(div);

  // Scroll to show the TOP of new text (not bottom)
  // This ensures long text blocks are visible from the start
  div.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Track for highlighting (only for game text, not commands)
  if (!isCommand) {
    currentGameTextElement = div;
  }

  return div;  // Return the element for highlighting later
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Stop narration (for "Skip" command or internal use)
// preserveHighlight: if true, don't remove highlighting (for pause)
function stopNarration(preserveHighlight = false) {
  // CRITICAL: Increment session ID to invalidate ALL old async loops
  // This kills any running speakTextChunked() loops immediately
  narrationSessionId++;
  console.log('[TTS] Stopping narration - new session ID:', narrationSessionId);

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

  // Remove highlighting unless we're preserving it (for pause)
  if (!preserveHighlight) {
    removeHighlight();
  }
}

// CSS Custom Highlight API - find text range without modifying DOM
function findTextRange(container, searchText) {
  if (!container || !searchText) return null;

  // Normalize text for matching (same processing as narration chunks)
  function normalizeText(text) {
    return text
      .replace(/\s+/g, ' ')  // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Walk through ALL nodes (not just text) to handle <br> elements
  // Build NORMALIZED fullText (collapsed whitespace) while tracking original nodes
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL);
  let fullText = '';  // Normalized text (whitespace collapsed)
  const charMap = []; // Maps each character in normalized text to {node, offset}
  let lastWasSpace = true;  // Track if we just added a space (to collapse consecutive)

  let node;
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isSpace = char.match(/\s/);

        if (isSpace) {
          // Only add one space for consecutive whitespace
          if (!lastWasSpace) {
            charMap.push({ node, offset: i, normalized: ' ' });
            fullText += ' ';
            lastWasSpace = true;
          }
        } else {
          charMap.push({ node, offset: i, normalized: char });
          fullText += char;
          lastWasSpace = false;
        }
      }
    } else if (node.nodeName === 'BR' || (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('soft-break'))) {
      // Treat <br> and soft-break spans as single spaces
      if (!lastWasSpace) {
        charMap.push({ node: node.parentNode, offset: 0, normalized: ' ' });
        fullText += ' ';
        lastWasSpace = true;
      }
    }
  }

  // Trim the normalized text
  fullText = fullText.trim();

  // Simple case-insensitive search on normalized text
  const lowerFullText = fullText.toLowerCase();
  const lowerSearchText = searchText.toLowerCase().trim();

  const matchIndex = lowerFullText.indexOf(lowerSearchText);
  if (matchIndex === -1) {
    console.log('[Highlight] Text not found!');
    console.log('[Highlight] Searching for:', lowerSearchText);
    console.log('[Highlight] Search length:', lowerSearchText.length);
    console.log('[Highlight] In text:', lowerFullText);
    console.log('[Highlight] Text length:', lowerFullText.length);
    console.log('[Highlight] First 100 chars of search:', lowerSearchText.substring(0, 100));
    console.log('[Highlight] First 100 chars of text:', lowerFullText.substring(0, 100));
    return null;
  }

  const rangeStart = matchIndex;
  const rangeEnd = matchIndex + lowerSearchText.length;

  // Use charMap to find the DOM nodes and offsets for the match
  if (rangeStart >= charMap.length || rangeEnd > charMap.length) {
    console.warn('[Highlight] Range out of bounds');
    return null;
  }

  const startEntry = charMap[rangeStart];
  const endEntry = charMap[rangeEnd - 1]; // End is exclusive, so use -1

  if (!startEntry || !endEntry) {
    console.warn('[Highlight] Could not find charMap entries');
    return null;
  }

  const startNode = startEntry.node;
  const startOffset = startEntry.offset;
  const endNode = endEntry.node;
  const endOffset = endEntry.offset + 1; // +1 because Range end is exclusive

  try {
    const range = new Range();
    range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.textContent.length)));
    range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.textContent.length)));
    return range;
  } catch (e) {
    console.warn('[Highlight] Range creation failed:', e);
    return null;
  }
}

// Highlight text being spoken using CSS Custom Highlight API
function highlightSpokenText(text) {
  if (!CSS.highlights) {
    console.log('[Highlight] CSS Custom Highlight API not supported');
    return;
  }

  try {
    const container = document.querySelector('#gameOutputInner .game-text:last-child');
    if (!container) return;

    const range = findTextRange(container, text);
    if (!range) {
      console.log('[Highlight] Could not find text range');
      return;
    }

    // Clear existing highlight first (fixes iOS WebKit issue where old highlight persists)
    CSS.highlights.delete('speaking');
    const highlight = new Highlight(range);
    CSS.highlights.set('speaking', highlight);

    // Scroll highlighted text into view
    try {
      const rect = range.getBoundingClientRect();
      if (rect.top < 100 || rect.bottom > window.innerHeight - 100) {
        range.startContainer.parentElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    } catch (e) {
      // Ignore scroll errors
    }

    console.log('[Highlight] Applied to:', text.substring(0, 30) + '...');
  } catch (error) {
    console.error('[Highlight] Error:', error);
  }
}

// Remove highlight when done
function removeHighlight() {
  if (CSS.highlights) {
    CSS.highlights.delete('speaking');
  }
}

// Highlight using marker elements
function highlightUsingMarkers(chunkIndex) {
  // Remove previous highlight
  removeHighlight();

  // Make sure we have a current game text element to search within
  if (!currentGameTextElement) {
    console.warn(`[Highlight] No currentGameTextElement - cannot highlight`);
    return false;
  }

  // System 1 markers: chunk-marker-start and chunk-marker-end
  // Both have data-chunk="${chunkIndex}" for the same chunk
  const startSelector = `.chunk-marker-start[data-chunk="${chunkIndex}"]`;
  const endSelector = `.chunk-marker-end[data-chunk="${chunkIndex}"]`;

  console.log(`[Highlight] Looking for chunk ${chunkIndex}: start="${startSelector}", end="${endSelector}"`);

  const startMarker = currentGameTextElement.querySelector(startSelector);
  const endMarker = currentGameTextElement.querySelector(endSelector);

  console.log(`[Highlight] Found: startMarker=${!!startMarker}, endMarker=${!!endMarker}`);

  if (!startMarker) {
    console.warn(`[Highlight] No start marker found for chunk ${chunkIndex}`);
    // Debug: Show what markers exist in the current text element
    const allMarkers = currentGameTextElement.querySelectorAll('.chunk-marker-start, .chunk-marker-end');
    console.log(`[Highlight] Available markers in current text:`, Array.from(allMarkers).map(m => `${m.className}[${m.dataset.chunk}]`));
    return false;
  }

  // For the last chunk, there's no end marker - highlight to end of container
  if (!endMarker && chunkIndex < narrationChunks.length - 1) {
    console.warn(`[Highlight] No end marker found for chunk ${chunkIndex} (expected)`);
    return false;
  }

  try {
    // Create range between markers
    const range = new Range();
    range.setStartAfter(startMarker);

    if (endMarker) {
      range.setEndBefore(endMarker);
    } else {
      // Last chunk: highlight to end of the current game text element
      if (currentGameTextElement && currentGameTextElement.lastChild) {
        range.setEndAfter(currentGameTextElement.lastChild);
      }
    }

    // Apply CSS Highlight API
    const highlight = new Highlight(range);
    CSS.highlights.set('speaking', highlight);

    console.log(`[Highlight] Applied highlight for chunk ${chunkIndex} (start: ${startMarker.dataset.chunk}, end: ${endMarker ? endMarker.dataset.chunk : 'EOF'})`);
    return true;
  } catch (e) {
    console.warn(`[Highlight] Failed to highlight chunk ${chunkIndex}:`, e);
    return false;
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

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Calculate similarity ratio (0 = different, 1 = identical)
function textSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - (levenshteinDistance(str1, str2) / maxLen);
}

// Check if text is echo of recently spoken TTS
function isEchoOfSpokenText(transcript) {
  if (!transcript || transcript.length < 3) return false;

  const now = Date.now();
  const normalizedTranscript = transcript.toLowerCase().trim();

  // Clean up old entries
  recentlySpokenChunks = recentlySpokenChunks.filter(
    chunk => (now - chunk.timestamp) < ECHO_CHUNK_RETENTION_MS
  );

  for (const chunk of recentlySpokenChunks) {
    const normalizedChunk = chunk.text.toLowerCase().trim();

    // Check for substring match (even partial)
    if (normalizedChunk.includes(normalizedTranscript) ||
        normalizedTranscript.includes(normalizedChunk)) {
      console.log('[Echo] Substring match:', transcript);
      return true;
    }

    // Check similarity ratio
    const similarity = textSimilarity(normalizedTranscript, normalizedChunk);
    if (similarity >= ECHO_SIMILARITY_THRESHOLD) {
      console.log('[Echo] Similarity ' + (similarity * 100).toFixed(0) + '%:', transcript);
      return true;
    }

    // Check word overlap for phrases (3+ words)
    const transcriptWords = normalizedTranscript.split(/\s+/).filter(w => w.length > 2);
    const chunkWords = normalizedChunk.split(/\s+/).filter(w => w.length > 2);

    if (transcriptWords.length >= 2 && chunkWords.length >= 3) {
      const commonWords = transcriptWords.filter(w => chunkWords.includes(w));
      const wordOverlap = commonWords.length / transcriptWords.length;
      if (wordOverlap >= 0.5) {
        console.log('[Echo] Word overlap ' + (wordOverlap * 100).toFixed(0) + '%:', transcript);
        return true;
      }
    }
  }
  return false;
}

// Record a chunk as spoken for echo detection
function recordSpokenChunk(text) {
  if (!text || text.length < 3) return;
  recentlySpokenChunks.push({ text: text, timestamp: Date.now() });
  if (recentlySpokenChunks.length > 30) recentlySpokenChunks.shift();
  console.log('[Echo] Recorded:', text.substring(0, 40) + '...');
}

// Shared function: Process text the same way for TTS and highlighting
function processTextForTTS(text) {
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

// Shared function: Split processed text into sentences
// Used by both createNarrationChunks() and insertSentenceMarkersInHTML()
// to ensure they split the same way
function splitIntoSentences(processedText) {
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

// ===== TEMPORARY MARKER SYSTEM =====
// Insert temp markers, let chunk creation determine which survive, then insert real DOM markers

// Step 1: Insert temporary markers BEFORE EVERY delimiter in HTML
function insertTemporaryMarkers(html) {
  if (!html) return html;

  console.log('[Markers] Original HTML (full):', html);

  let markerCount = 0;
  const insertPositions = [];

  // Insert markers BEFORE ALL sentence-ending punctuation AND before paragraph breaks
  let markedHTML = html;

  // First, mark paragraph breaks (<br><br>) since they become ". " during processing
  markedHTML = markedHTML.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, (match, offset) => {
    insertPositions.push({ offset, punct: '<br><br>', after: '→', context: 'paragraph break' });
    const marker = `⚐${markerCount}⚐`;
    markerCount++;
    return marker + match;  // Marker BEFORE <br><br> (don't include line breaks in highlight)
  });

  // Then, mark regular punctuation followed by space/tag/end
  // BUT skip periods that are part of single-letter initials (H.P., U.S., etc.)
  // Use negative lookbehind to exclude periods preceded by uppercase letters
  markedHTML = markedHTML.replace(/(?<![A-Z])([.!?])(?=\s|<|$)/g, (match, punct, offset) => {
    insertPositions.push({ offset, punct, after: html.charAt(offset + 1) });
    const marker = `⚐${markerCount}⚐`;
    markerCount++;
    return punct + marker;  // Marker AFTER punctuation
  });

  console.log('[Markers] Found', insertPositions.length, 'delimiters:');
  insertPositions.forEach((pos, i) => {
    const context = html.substring(Math.max(0, pos.offset - 20), Math.min(html.length, pos.offset + 20));
    console.log(`  [${i}] offset=${pos.offset}, punct="${pos.punct}", after="${pos.after}", context: "...${context}..."`);
  });
  console.log('[Markers] Inserted', markerCount, 'temporary markers before delimiters');
  console.log('[Markers] Full HTML length:', html.length, 'characters');
  return markedHTML;
}

// 2. Extract which marker IDs survived in the chunks
function extractSurvivingMarkerIDs(chunks) {
  const markerRegex = /⚐(\d+)⚐/g;
  const survivingIDs = new Set();

  chunks.forEach((chunk, idx) => {
    let match;
    while ((match = markerRegex.exec(chunk)) !== null) {
      survivingIDs.add(parseInt(match[1]));
    }
  });

  const ids = Array.from(survivingIDs).sort((a, b) => a - b);
  console.log('[Markers] Surviving marker IDs:', ids);
  return ids;
}

// 3. Insert real <span> markers at positions marked by temp markers
function insertRealMarkersAtIDs(container, markerIDs) {
  if (!markerIDs || markerIDs.length === 0) {
    console.log('[Markers] No marker IDs to insert');
    return;
  }

  console.log('[Markers] Inserting real markers for IDs:', markerIDs);

  // Walk through all text nodes to find temporary markers
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }

  // Process in reverse to avoid position shifts
  for (let i = nodesToProcess.length - 1; i >= 0; i--) {
    const textNode = nodesToProcess[i];
    const text = textNode.textContent;

    // Find all markers in this text node
    const markerRegex = /⚐(\d+)⚐/g;
    const matches = [];
    let match;

    while ((match = markerRegex.exec(text)) !== null) {
      const markerID = parseInt(match[1]);
      if (markerIDs.includes(markerID)) {
        matches.push({
          id: markerID,
          index: match.index,
          length: match[0].length
        });
      }
    }

    // Insert real markers in reverse order (to preserve positions)
    for (let j = matches.length - 1; j >= 0; j--) {
      const markerMatch = matches[j];
      const chunkIndex = markerIDs.indexOf(markerMatch.id);

      try {
        // Split text node at marker position
        const beforeText = text.substring(0, markerMatch.index);
        const afterText = text.substring(markerMatch.index + markerMatch.length);

        // Create new text nodes
        const beforeNode = document.createTextNode(beforeText);
        const afterNode = document.createTextNode(afterText);

        // Create real marker spans
        const endMarker = document.createElement('span');
        endMarker.className = 'chunk-marker-end';
        endMarker.dataset.chunk = chunkIndex;
        endMarker.style.cssText = 'display: none; position: absolute;';

        const startMarker = document.createElement('span');
        startMarker.className = 'chunk-marker-start';
        startMarker.dataset.chunk = chunkIndex + 1;
        startMarker.style.cssText = 'display: none; position: absolute;';

        // Replace text node with: before + endMarker + startMarker + after
        const parent = textNode.parentNode;
        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(endMarker, textNode);
        parent.insertBefore(startMarker, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        console.log(`[Markers] Inserted real markers for ID ${markerMatch.id} (chunk ${chunkIndex})`);
      } catch (e) {
        console.warn(`[Markers] Failed to insert markers for ID ${markerMatch.id}:`, e);
      }
    }
  }
}

// 4. Remove all temporary markers from DOM and text
function removeTemporaryMarkers(container, chunks) {
  // Remove from DOM
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToClean = [];
  let node;
  while (node = walker.nextNode()) {
    if (/⚐\d+⚐/.test(node.textContent)) {
      nodesToClean.push(node);
    }
  }

  nodesToClean.forEach(textNode => {
    textNode.textContent = textNode.textContent.replace(/⚐\d+⚐/g, '');
  });

  // Remove from chunks array (modify in place)
  for (let i = 0; i < chunks.length; i++) {
    chunks[i] = chunks[i].replace(/⚐\d+⚐/g, '');
  }

  console.log('[Markers] Removed all temporary markers');
}

// ===== DEPRECATED OLD MARKER SYSTEM =====
// The functions below are replaced by the temporary marker system above
// Kept for reference only - DO NOT USE

/*
// Extract plain text from HTML container while tracking which DOM nodes it came from
function extractTextWithNodes(container) {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let plainText = '';
  const textNodes = [];
  let node;

  while (node = walker.nextNode()) {
    const startPos = plainText.length;
    const nodeText = node.textContent;
    plainText += nodeText;
    const endPos = plainText.length;

    textNodes.push({
      node: node,
      startPos: startPos,
      endPos: endPos
    });
  }

  console.log('[Markers] Extracted', plainText.length, 'chars from', textNodes.length, 'text nodes');
  return { plainText, textNodes };
}

// Split text into chunks and return both chunks and boundary positions
function splitWithBoundaryPositions(processedText) {
  const chunks = splitIntoSentences(processedText);
  const boundaries = [];

  let position = 0;
  for (let i = 0; i < chunks.length; i++) {
    position += chunks[i].length;
    if (i < chunks.length - 1) {
      // Add boundary after this chunk (before next chunk)
      boundaries.push(position);
      // Account for the whitespace between chunks that was removed during split
      position += 1;
    }
  }

  console.log('[Markers] Found', chunks.length, 'chunks with', boundaries.length, 'boundaries');
  console.log('[Markers] Boundary positions in processed text:', boundaries);
  return { chunks, boundaries };
}

// Map positions from processed text back to plain text positions
// Tracks how text transformations shift positions
function mapProcessedToPlainPositions(plainText, processedText, boundaries) {
  console.log('[Markers] Mapping', boundaries.length, 'boundaries from processed to plain text');

  // Build a character-level map by simulating the processing
  const charMap = []; // charMap[processedIndex] = plainIndex

  let plainIndex = 0;
  let processedIndex = 0;

  // We need to simulate processTextForTTS transformations
  // This is simplified - we'll track major transformations

  // For now, use a simpler approach: find each chunk in the plain text
  const plainBoundaries = [];
  const { chunks } = splitWithBoundaryPositions(processedText);

  let searchStart = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Try to find this chunk (or a close match) in plain text
    // Account for case differences and minor transformations
    const chunkLower = chunk.toLowerCase().substring(0, 20); // First 20 chars for matching
    const plainLower = plainText.toLowerCase();

    let matchIndex = plainLower.indexOf(chunkLower, searchStart);

    if (matchIndex !== -1) {
      // Found the chunk, boundary is at the end of this chunk
      const boundaryPos = matchIndex + chunk.length;
      plainBoundaries.push(boundaryPos);
      searchStart = boundaryPos;
      console.log(`[Markers] Chunk ${i} found at plain text position ${matchIndex}, boundary at ${boundaryPos}`);
    } else {
      console.warn(`[Markers] Could not find chunk ${i} in plain text:`, chunk.substring(0, 30));
    }
  }

  return plainBoundaries;
}

// Find the DOM node and offset for a given position in plain text
function findNodeAtPosition(textNodes, position) {
  for (const nodeInfo of textNodes) {
    if (position >= nodeInfo.startPos && position <= nodeInfo.endPos) {
      const offset = position - nodeInfo.startPos;
      return { node: nodeInfo.node, offset: offset };
    }
  }

  // If not found, return last node
  const lastNode = textNodes[textNodes.length - 1];
  return { node: lastNode.node, offset: lastNode.node.textContent.length };
}

// Insert marker span in DOM at specified node and offset
function insertMarkerInNode(node, offset, chunkIndex) {
  try {
    // Create start marker for next chunk
    const startMarker = document.createElement('span');
    startMarker.className = 'chunk-marker-start';
    startMarker.dataset.chunk = chunkIndex + 1;
    startMarker.style.cssText = 'display: none; position: absolute;';

    // Create end marker for current chunk
    const endMarker = document.createElement('span');
    endMarker.className = 'chunk-marker-end';
    endMarker.dataset.chunk = chunkIndex;
    endMarker.style.cssText = 'display: none; position: absolute;';

    // Split the text node at the offset
    if (offset > 0 && offset < node.textContent.length) {
      const afterNode = node.splitText(offset);
      // Insert markers between the split nodes
      node.parentNode.insertBefore(endMarker, afterNode);
      node.parentNode.insertBefore(startMarker, afterNode);
    } else if (offset === 0) {
      // Insert at the beginning
      node.parentNode.insertBefore(endMarker, node);
      node.parentNode.insertBefore(startMarker, node);
    } else {
      // Insert at the end
      node.parentNode.insertBefore(endMarker, node.nextSibling);
      node.parentNode.insertBefore(startMarker, node.nextSibling);
    }

    console.log(`[Markers] Inserted markers for chunk ${chunkIndex} at offset ${offset}`);
  } catch (e) {
    console.warn(`[Markers] Failed to insert markers for chunk ${chunkIndex}:`, e);
  }
}

// Main function: Create narration chunks and insert markers in one pass
// This ensures chunks and markers are perfectly aligned
function createChunksAndMarkersInOnePass(html) {
  if (!html) return { chunks: [], markedHTML: html };

  console.log('[Markers] Creating chunks and markers in one pass');

  const container = document.createElement('div');
  container.innerHTML = html;

  // Step 1: Extract plain text while tracking DOM nodes
  const { plainText, textNodes } = extractTextWithNodes(container);

  // Handle <br> tags as spaces for TTS (same as createNarrationChunks)
  let textForProcessing = plainText;

  // Step 2: Process text for TTS (apply all transformations)
  const processedText = processTextForTTS(textForProcessing);

  // Step 3: Split into chunks and get boundary positions in processed text
  const { chunks, boundaries } = splitWithBoundaryPositions(processedText);

  // Step 4: Map boundary positions from processed text back to plain text
  const plainBoundaries = mapProcessedToPlainPositions(plainText, processedText, boundaries);

  // Step 5: Insert markers in DOM at plain text boundary positions
  // Also insert start marker for first chunk
  const firstTextNode = textNodes[0];
  if (firstTextNode) {
    try {
      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = 0;
      startMarker.style.cssText = 'display: none; position: absolute;';
      firstTextNode.node.parentNode.insertBefore(startMarker, firstTextNode.node);
      console.log('[Markers] Inserted start marker for chunk 0');
    } catch (e) {
      console.warn('[Markers] Failed to insert start marker:', e);
    }
  }

  // Insert markers at boundaries (in reverse to preserve positions)
  for (let i = plainBoundaries.length - 1; i >= 0; i--) {
    const position = plainBoundaries[i];
    const { node, offset } = findNodeAtPosition(textNodes, position);
    insertMarkerInNode(node, offset, i);
  }

  console.log('[Markers] Successfully created', chunks.length, 'chunks with', plainBoundaries.length, 'markers');

  return {
    chunks: chunks,
    markedHTML: container.innerHTML
  };
}
*/
// ===== END DEPRECATED MARKER SYSTEM =====

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
      updateNavButtons();
      // Resume recognition if listening was enabled
      if (listeningEnabled && recognition && !isMuted && !isRecognitionActive) {
        try {
          recognition.start();
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
      updateNavButtons();
      // Resume recognition if listening was enabled
      if (listeningEnabled && recognition && !isMuted && !isRecognitionActive) {
        try {
          recognition.start();
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
    recordSpokenChunk(text);  // Record for echo detection BEFORE speaking
    speechSynthesis.speak(utterance);
    console.log('[Browser TTS] Speaking:', text.substring(0, 50) + '...');
  });
}

// Create narration chunks from HTML with temporary markers
// Returns array of {text, markerID, index} for each chunk
// text: processed for TTS, markerID: the ⚐N⚐ marker at end of chunk (or null for last chunk)
function createNarrationChunks(html) {
  if (!html) return [];

  // Process HTML to plain text (keeps ⚐N⚐ markers)
  const tempDiv = document.createElement('div');
  let htmlForText = html
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')  // Paragraph breaks -> sentence break
    .replace(/<br\s*\/?>/gi, ' ')                 // Single line breaks -> space
    .replace(/<span class="soft-break"><\/span>/gi, ' ');  // Soft breaks -> space
  tempDiv.innerHTML = htmlForText;
  const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();

  // Process text for TTS (markers move with the text during processing)
  const processedText = processTextForTTS(plainText);

  // Split into sentences
  const sentences = splitIntoSentences(processedText);

  console.log('[TTS] Split into', sentences.length, 'chunks');

  // Extract marker ID from end of each chunk
  const markerRegex = /⚐(\d+)⚐/;
  return sentences.map((sentence, index) => {
    const match = sentence.match(markerRegex);
    const markerID = match ? parseInt(match[1]) : null;

    // Remove marker from text for TTS playback
    const cleanText = sentence.replace(/⚐\d+⚐/g, '').trim();

    console.log(`[Markers] Chunk ${index}: marker ${markerID !== null ? markerID : 'none (last chunk)'}`);
    console.log(`[Markers]   Raw: "${sentence.substring(0, 80)}..."`);
    console.log(`[Markers]   Clean: "${cleanText.substring(0, 80)}..."`);

    return {
      text: cleanText,       // For TTS playback
      markerID: markerID,    // For inserting DOM markers
      index
    };
  });
}

// Insert sentence markers into HTML BEFORE rendering
// Uses shared splitting logic to ensure markers match narration chunks exactly
function insertSentenceMarkersInHTML(html) {
  if (!html) return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  // Extract and process text THE SAME WAY as createNarrationChunks()
  const tempDiv = document.createElement('div');
  let htmlForProcessing = html
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '. ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<span class="soft-break"><\/span>/gi, ' ');
  tempDiv.innerHTML = htmlForProcessing;
  const plainText = tempDiv.textContent || '';

  // Process and split using shared functions (guarantees same results as createNarrationChunks)
  const processedText = processTextForTTS(plainText);
  const sentences = splitIntoSentences(processedText);

  console.log('[Markers] Will insert', sentences.length, 'markers for sentences');

  // For each sentence, find it in the DOM and insert markers around it
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // Use existing findTextRange() to locate this sentence in the DOM
    const range = findTextRange(container, sentence);

    if (!range) {
      console.warn(`[Markers] Sentence ${i} not found:`, sentence.substring(0, 40));
      continue;
    }

    try {
      // Create markers
      const endMarker = document.createElement('span');
      endMarker.className = 'chunk-marker-end';
      endMarker.dataset.chunk = i;
      endMarker.style.cssText = 'display: none; position: absolute;';

      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = i;
      startMarker.style.cssText = 'display: none; position: absolute;';

      // Insert end marker first (so start position doesn't shift)
      range.collapse(false);  // Collapse to end
      range.insertNode(endMarker);

      // Find the sentence again to insert start marker (DOM was modified)
      const rangeForStart = findTextRange(container, sentence);
      if (rangeForStart) {
        rangeForStart.collapse(true);  // Collapse to start
        rangeForStart.insertNode(startMarker);
        console.log(`[Markers] Inserted markers for sentence ${i}`);
      } else {
        console.warn(`[Markers] Could not re-find sentence ${i} for start marker`);
      }
    } catch (e) {
      console.warn(`[Markers] Failed to insert markers for sentence ${i}:`, e);
    }
  }

  console.log('[Markers] Pre-inserted', sentences.length, 'sentence markers in HTML');
  return container.innerHTML;
}

// DEPRECATED: Insert invisible marker spans at sentence boundaries
// This function is no longer used - markers are inserted before rendering
function insertChunkMarkers(containerElement) {
  if (!containerElement || narrationChunks.length === 0) {
    console.log('[Markers] No container or chunks to mark');
    return;
  }

  console.log('[Markers] Inserting markers for', narrationChunks.length, 'chunks');

  // For each chunk, use existing findTextRange() to locate it in DOM
  for (let i = 0; i < narrationChunks.length; i++) {
    const chunk = narrationChunks[i];

    // Reuse existing findTextRange() - it already handles text transformations
    const range = findTextRange(containerElement, chunk);

    if (!range) {
      console.warn(`[Markers] Chunk ${i} not found:`, chunk.substring(0, 40));
      continue;
    }

    // Insert markers at range boundaries
    try {
      const endMarker = document.createElement('span');
      endMarker.className = 'chunk-marker-end';
      endMarker.dataset.chunk = i;
      endMarker.style.cssText = 'display: none; position: absolute;';

      const startMarker = document.createElement('span');
      startMarker.className = 'chunk-marker-start';
      startMarker.dataset.chunk = i;
      startMarker.style.cssText = 'display: none; position: absolute;';

      // Insert end marker first (so start position doesn't shift)
      range.collapse(false);  // Collapse to end
      range.insertNode(endMarker);

      // Reset range and insert start marker
      range.setStart(range.startContainer, range.startOffset);
      range.collapse(true);  // Collapse to start
      range.insertNode(startMarker);

      console.log(`[Markers] Inserted markers for chunk ${i}`);
    } catch (e) {
      console.warn(`[Markers] Failed to insert markers for chunk ${i}:`, e);
    }
  }
}
// ===== END DEPRECATED CODE (Part 2) =====

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

  // CRITICAL: Capture the session ID - this loop is only valid for this session
  // If stopNarration() is called, it increments the session ID, invalidating this loop
  const mySessionId = narrationSessionId;
  console.log('[TTS] Starting narration session', mySessionId);

  // Chunks are now created in addGameText() when text is displayed
  // No need to create them here

  currentChunkIndex = startFromIndex;
  isPaused = false;

  // Don't use local chunk reference - we want to stop if chunks change
  const totalChunks = narrationChunks.length;

  // Start from current index
  for (let i = currentChunkIndex; i < totalChunks; i++) {
    console.log(`[TTS Loop] Iteration start: i=${i}, totalChunks=${totalChunks}, sessionID=${mySessionId}/${narrationSessionId}`);

    // CRITICAL: Check if this session is still valid
    // If stopNarration() was called, session ID will have changed
    if (mySessionId !== narrationSessionId) {
      console.log(`[TTS] Session ${mySessionId} invalidated (current: ${narrationSessionId}) - stopping loop`);
      return;  // Exit immediately - this loop is dead
    }

    // Update position at START of iteration
    currentChunkIndex = i;

    // Check narration state at start of EVERY iteration
    if (!narrationEnabled || isPaused) {
      console.log('[TTS] Loop stopped at chunk', i, '- narrationEnabled:', narrationEnabled, 'isPaused:', isPaused);
      // currentChunkIndex already set above

      // Remove highlighting
      removeHighlight();
      break;
    }

    console.log(`[TTS Loop] Passed all checks, proceeding with chunk ${i}`);
    updateNavButtons();

    // Highlight current sentence
    updateTextHighlight(i);

    const chunkText = narrationChunks[i];
    console.log(`[TTS] Playing chunk ${i + 1}/${totalChunks}: "${chunkText.substring(0, 50)}..."`);

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

    // CRITICAL: Check session ID again after async wait
    if (mySessionId !== narrationSessionId) {
      console.log(`[TTS] Session ${mySessionId} invalidated while waiting for audio - stopping`);
      return;  // Exit immediately
    }

    // Check again if we should still play (user might have skipped while waiting)
    if (!narrationEnabled || isPaused || currentChunkIndex !== i) {
      console.log('[TTS] Cancelled - navigation changed while waiting for audio');

      // Remove highlighting when cancelled
      removeHighlight();
      break;
    }

    if (audioData) {
      // Mark when this chunk started playing (for smart back button)
      currentChunkStartTime = Date.now();
      console.log(`[TTS Loop] About to play audio for chunk ${i}`);
      await playAudio(audioData);
      console.log(`[TTS Loop] Finished playing audio for chunk ${i}`);

      // Check session ID after playing audio (in case stopped during playback)
      if (mySessionId !== narrationSessionId) {
        console.log(`[TTS] Session ${mySessionId} invalidated after playing audio - stopping`);
        return;
      }
      console.log(`[TTS Loop] Session still valid after chunk ${i}, continuing to next iteration`);
    }
    console.log(`[TTS Loop] End of iteration ${i}, about to increment`);
  }

  console.log(`[TTS Loop] Exited loop - currentChunkIndex=${currentChunkIndex}, totalChunks=${totalChunks}`);

  // Finished all chunks - only process if this session is still valid
  if (mySessionId !== narrationSessionId) {
    console.log(`[TTS] Session ${mySessionId} ended - not processing completion`);
    return;
  }

  if (currentChunkIndex >= totalChunks - 1 && narrationEnabled && !isPaused) {
    console.log('[TTS] Narration complete - staying at end position');

    // Stay at end (past last chunk) - allows Back button to work
    currentChunkIndex = totalChunks;
    narrationEnabled = false;
    isPaused = true;
    isNarrating = false;

    // Remove highlighting when narration completes (at end, no chunk to highlight)
    removeHighlight();

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

  // Special case: if at end (past last chunk) and going back, jump to last chunk
  if (offset === -1 && currentChunkIndex >= narrationChunks.length) {
    targetIndex = narrationChunks.length - 1;
    console.log(`[TTS] Back from end: jumping to last chunk ${targetIndex}`);
  }
  // Smart back button: if going back and within 500ms of current chunk start, go to previous chunk instead
  else if (offset === -1) {
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

    // Always update highlighting to first chunk
    updateTextHighlight(0);

    // Start playing if: (was playing before) OR (autoplay is enabled)
    if (shouldResume || autoplayEnabled) {
      isPaused = false;
      narrationEnabled = true;
      speakTextChunked(null, 0);
    } else {
      // Stay paused but keep first chunk highlighted
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

  // Jump past end (no highlighting - navigator is past content)
  currentChunkIndex = narrationChunks.length;
  currentChunkStartTime = 0;

  updateNavButtons();
  updateStatus('⏩ Skipped to end');

  // Remove all highlighting (at end, no chunk to highlight)
  removeHighlight();

  // Scroll to bottom of game output
  if (gameOutput) {
    gameOutput.scrollTop = gameOutput.scrollHeight;
  }

  console.log('[TTS] Force stop complete - position:', currentChunkIndex + 1, '/', narrationChunks.length);
}

// Update text highlighting for a specific chunk
function updateTextHighlight(chunkIndex) {
  if (narrationChunks.length === 0 || chunkIndex < 0 || chunkIndex >= narrationChunks.length) {
    removeHighlight();
    return;
  }

  // Try marker-based highlighting first
  const success = highlightUsingMarkers(chunkIndex);

  // Fallback: If markers failed, try old text-search method
  if (!success) {
    console.log('[Highlight] Markers failed, trying text search fallback');
    const chunkText = narrationChunks[chunkIndex];
    if (chunkText) {
      highlightSpokenText(chunkText);
    }
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
    // Enabled unless at or before first chunk (also enabled when "at end")
    prevBtn.disabled = currentChunkIndex <= 0;
  }

  if (nextBtn) {
    // Disabled when at or past last chunk
    nextBtn.disabled = currentChunkIndex >= narrationChunks.length - 1;
  }

  if (skipToEndBtn) {
    // Disabled only when already at end (past last chunk)
    skipToEndBtn.disabled = currentChunkIndex >= narrationChunks.length;
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
    // Set game name for save/restore (strip path and extension)
    currentGameName = gamePath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    console.log('[Game] Starting:', currentGameName);

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

      // Reset narration state for new game
      pendingNarrationText = output;
      narrationChunks = [];
      currentChunkIndex = 0;
      isPaused = false;

      // Display the game output (this creates chunks and markers)
      addGameText(output);

      // Chunks are now ready, update UI
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

      // Reset narration for new text
      pendingNarrationText = output;
      narrationChunks = [];  // Clear old chunks
      currentChunkIndex = 0;
      isPaused = false;

      // Display the game output (this creates chunks and markers)
      addGameText(output);

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

// Click on game-text focuses text input (but not when selecting text)
gameOutput.addEventListener('click', (e) => {
  // Don't focus if user was selecting text
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) {
    return;
  }

  // Only focus if clicking on game-text element or its descendants
  const gameText = e.target.closest('.game-text');
  if (gameText) {
    userInput.focus();
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

    // Update meter and detect sound for pause/resume
    voiceMeterInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const percentage = Math.min(100, (average / 128) * 100);

      // Update mute button indicator (bright green if > 20%, normal green otherwise)
      // But NOT when muted - keep muted state
      if (!isMuted) {
        if (percentage > 20) {
          muteBtn.classList.add('active');
          voiceTranscript.textContent = 'Speaking... (say "Pause" to stop)';
        } else {
          muteBtn.classList.remove('active');
          voiceTranscript.textContent = 'Listening...';
        }
      }

      // Sound detection (for voice visualization only, no longer pauses narration)
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

  muteBtn.classList.remove('active');
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

  // Start narration if there are existing chunks
  // Note: Chunks were already created by addGameText() with temporary markers
  pendingNarrationText = null;  // Clear pending text flag

  if (narrationChunks.length > 0) {
    console.log('[TTS] Starting narration from existing chunks:', narrationChunks.length);
    await speakTextChunked(null, 0);
  }
}

// Mute button (mutes microphone input, but keeps recognition running for "unmute" command)
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  const icon = muteBtn.querySelector('.material-icons');

  if (isMuted) {
    // Muted: keep recognition running but ignore all commands except "unmute"
    // Don't set listeningEnabled = false, so recognition continues

    stopVoiceMeter();

    // Hide voice feedback panel (hides "Say something..." etc)
    voiceFeedback.classList.add('hidden');

    // Add muted state to voice panel (hides "Say something..." placeholder)
    voicePanel.classList.add('muted');

    // Update mute button to muted state (grayed out, "Muted" text)
    muteBtn.classList.remove('active');
    muteBtn.classList.add('muted');
    voiceTranscript.textContent = 'Muted';

    if (icon) icon.textContent = 'mic_off';
    updateStatus('Muted - say "unmute" to resume');

    console.log('[Mute] Muted, recognition still running:', isRecognitionActive);
  } else {
    // Resume listening (unmute mic)
    listeningEnabled = true;

    voiceFeedback.classList.remove('hidden');

    // Remove muted state from voice panel
    voicePanel.classList.remove('muted');

    // Update mute button to listening state
    muteBtn.classList.remove('muted');
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
    stopNarration(true);  // preserveHighlight = true
    isPaused = true;
    updateNavButtons();
    updateStatus('Narration paused');

    // Highlighting already preserved by stopNarration(true)
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

// Clear screen on scene change (status line changed)
socket.on('clear-screen', () => {
  console.log('[Game] Clear screen - scene change');
  gameOutputInner.innerHTML = '';
  // Reset narration state for new scene
  stopNarration();
  narrationChunks = [];
  currentChunkIndex = 0;
  narrationSessionId++;
  updateNavButtons();
});

// ============== SAVE/RESTORE SYSTEM (localStorage) ==============

// Current game name (set when game starts)
let currentGameName = null;

// Handle save data from server
socket.on('save-data', ({ game, data, timestamp }) => {
  currentGameName = game;

  // Get existing saves for this game
  const savesKey = `iftalk_saves_${game}`;
  const saves = JSON.parse(localStorage.getItem(savesKey) || '{"slots":{}}');

  // Auto-assign to next available slot (1-10) or slot 1 if all full
  let slot = 1;
  for (let i = 1; i <= 10; i++) {
    if (!saves.slots[i]) {
      slot = i;
      break;
    }
  }

  // Store save data with quota checking
  const dataKey = `iftalk_save_${game}_${slot}`;
  try {
    localStorage.setItem(dataKey, data);

    // Update saves metadata
    saves.slots[slot] = {
      timestamp,
      date: new Date(timestamp).toLocaleString()
    };
    localStorage.setItem(savesKey, JSON.stringify(saves));

    console.log(`[Save] Stored in localStorage: ${dataKey} (slot ${slot})`);
    updateStatus(`Game saved to slot ${slot}`);
    speakAppMessage(`Saved to slot ${slot}`);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('[Save] Storage quota exceeded');
      updateStatus('Storage full - delete old saves');
      speakAppMessage('Storage full. Please delete old saves to make room.');
    } else {
      console.error('[Save] Error storing save:', e);
      updateStatus('Save failed');
      speakAppMessage('Save failed');
    }
  }
});

// List all saves for current game
function listSaves() {
  if (!currentGameName) {
    console.log('[Save] No game loaded');
    return {};
  }

  const savesKey = `iftalk_saves_${currentGameName}`;
  const saves = JSON.parse(localStorage.getItem(savesKey) || '{"slots":{}}');
  console.log('[Save] Available saves:', saves.slots);
  return saves.slots;
}

// Restore from a specific slot
function restoreFromSlot(slot) {
  if (!currentGameName) {
    console.log('[Restore] No game loaded');
    return false;
  }

  const dataKey = `iftalk_save_${currentGameName}_${slot}`;
  const data = localStorage.getItem(dataKey);

  if (!data) {
    console.log(`[Restore] No save in slot ${slot}`);
    updateStatus(`No save in slot ${slot}`);
    speakAppMessage(`No save found in slot ${slot}`);
    return false;
  }

  // Send to server for restore
  socket.emit('restore-data', { data });
  console.log(`[Restore] Sent slot ${slot} to server`);
  updateStatus(`Restoring from slot ${slot}...`);
  speakAppMessage(`Restoring from slot ${slot}`);
  return true;
}

// Quick restore from most recent save
function restoreLatest() {
  const saves = listSaves();
  let latestSlot = null;
  let latestTime = 0;

  for (const [slot, info] of Object.entries(saves)) {
    if (info.timestamp > latestTime) {
      latestTime = info.timestamp;
      latestSlot = slot;
    }
  }

  if (latestSlot) {
    return restoreFromSlot(latestSlot);
  } else {
    updateStatus('No saves found');
    speakAppMessage('No saves found');
    return false;
  }
}

// Delete a save slot
function deleteSave(slot) {
  if (!currentGameName) return false;

  const dataKey = `iftalk_save_${currentGameName}_${slot}`;
  const savesKey = `iftalk_saves_${currentGameName}`;

  localStorage.removeItem(dataKey);

  try {
    const saves = JSON.parse(localStorage.getItem(savesKey) || '{"slots":{}}');
    delete saves.slots[slot];
    localStorage.setItem(savesKey, JSON.stringify(saves));

    console.log(`[Save] Deleted slot ${slot}`);
    return true;
  } catch (e) {
    console.error('[Save] Error updating saves metadata:', e);
    // Still return true since the actual save data was deleted
    return true;
  }
}

// ============== END SAVE/RESTORE SYSTEM ==============

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
