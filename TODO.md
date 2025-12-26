# IFTalk TODO

## 🚗 Current Priority: Bluetooth Car Mode

### Problem: Bluetooth Audio Conflicts

**User Report**: App has issues when used with car Bluetooth systems.

**Root Cause**: Web Speech API limitations with Bluetooth audio routing:
- When microphone is active (continuous listening), browser switches Bluetooth to **HFP (Hands-Free Profile)** - "call mode"
- Car thinks user is on a phone call continuously
- TTS narration plays through low-quality call audio instead of high-quality media audio
- Music/media may pause or be interrupted
- Browser constantly switches between HFP (mic/call) and A2DP (media) profiles, causing:
  - Audio stuttering
  - Connection instability
  - Poor user experience

**Why Current Approach Doesn't Work**:
- Continuous listening (mic always active) keeps Bluetooth in call mode
- Pausing mic during TTS would break voice commands (pause, skip, etc.)
- Web Speech API gives no control over audio routing or Bluetooth profiles
- Browser automatically manages Bluetooth profile switching - developers cannot override

### Proposed Solution: Push-to-Talk Mode

**Add a new voice input setting**: "Push-to-Talk Mode"

**Behavior Changes**:

**When DISABLED (current behavior)**:
- Mic icon toggles continuous listening on/off
- Always listening for voice commands when unmuted
- Bluetooth stays in call mode continuously
- Lower audio quality but fully hands-free

**When ENABLED (new push-to-talk behavior)**:
- Mic button becomes a **hold-to-talk** button (like walkie-talkie)
- Press and hold button → mic activates → speak command → release button
- When button not pressed: mic is OFF, Bluetooth stays in high-quality media mode
- TTS narration plays through A2DP media profile (high quality)
- When button pressed: Bluetooth briefly switches to call mode for voice input
- **Result**: Best audio quality, no constant "call mode", but requires button press

**Implementation Details**:

1. **Settings Toggle**:
   - Location: Settings → Voice & Input
   - Label: "Push-to-Talk Mode"
   - Description: "Hold mic button to speak (recommended for car Bluetooth)"
   - Default: OFF (current continuous listening)

2. **Mic Button Behavior**:
   - Store as `state.pushToTalkMode` boolean
   - When enabled:
     - `mousedown`/`touchstart` → start recognition
     - `mouseup`/`touchend`/`mouseleave`/`touchcancel` → stop recognition
     - Visual feedback: button stays highlighted while pressed
     - Status shows "Hold mic button to speak" when idle

3. **Recognition Lifecycle**:
   - Push-to-talk mode: Only start recognition when button is held
   - Don't auto-restart recognition in `onend` handler when push-to-talk enabled
   - Stop recognition when button is released

4. **User Experience**:
   - Clear visual indication of push-to-talk mode (button label/tooltip)
   - Audio feedback when mic activates/deactivates (optional beep)
   - Works with existing mute toggle (can still mute entirely)

5. **Compatibility**:
   - Desktop: Click and hold mic button
   - Mobile/car: Tap and hold mic button
   - Lock screen: Hold unlock button also activates mic?
   - Voice commands still work: pause, skip, etc. (while button is held)

**Files to Modify**:
- `docs/js/core/state.js` - Add `pushToTalkMode` flag
- `docs/js/voice/recognition.js` - Modify `onend` handler to respect push-to-talk mode
- `docs/js/app.js` - Add mousedown/mouseup handlers to mic button when push-to-talk enabled
- `docs/js/ui/settings/index.js` - Add push-to-talk toggle
- `docs/index.html` - Add push-to-talk setting in Voice & Input section
- `docs/styles.css` - Visual feedback for push-to-talk button state

**Testing Checklist**:
- [ ] Push-to-talk toggle appears in settings
- [ ] Mic button switches to hold-to-talk when enabled
- [ ] Recognition starts only when button is held
- [ ] Recognition stops when button is released
- [ ] Visual feedback shows button is pressed
- [ ] Status message indicates push-to-talk mode
- [ ] Mute toggle still works (overrides push-to-talk)
- [ ] TTS plays through media profile when mic is off
- [ ] Voice commands work while button is held
- [ ] Mobile touch events work correctly
- [ ] Desktop mouse events work correctly
- [ ] Setting persists across page reloads

**Alternative Approaches Considered**:

1. ❌ **Stop mic during TTS**: Breaks voice commands (pause, skip, etc.)
2. ❌ **Use server-side TTS**: Requires internet, costs money, complex implementation
3. ❌ **Longer delays between mic restarts**: Still switches profiles frequently, partial solution only
4. ✅ **Push-to-Talk Mode**: User chooses hands-free vs. audio quality, simple to implement

---

## 📋 Other Tasks (Lower Priority)

### Future: Cloud TTS for Better Bluetooth Audio Quality

**Problem**: Browser TTS (`speechSynthesis`) and Web Speech Recognition both use the same Bluetooth profile, causing audio quality issues in cars.

**Solution**: Use cloud-based TTS API that returns audio files, which can play through media profile (A2DP) instead of call profile (HFP).

**Benefits**:
- TTS narration plays through high-quality car speakers (media profile)
- Voice recognition stays in call profile
- No profile switching during narration
- Better audio quality overall
- More natural-sounding voices

**Options to Research**:

1. **Google Cloud Text-to-Speech**
   - Pricing: ~$4 per 1M characters (WaveNet voices)
   - Free tier: 1M characters/month (Standard voices)
   - Best voice quality, many languages
   - Would need API key and billing setup

2. **Amazon Polly**
   - Pricing: ~$4 per 1M characters (Neural voices)
   - Free tier: 5M characters/month for 12 months
   - Good voice quality, integrates with AWS
   - Would need AWS account

3. **Cloud TTS Providers** (Not currently supported)
   - Could add Google Cloud TTS, Azure TTS, etc. if needed
   - Currently using browser TTS only
   - Best quality but most expensive
   - Good for premium features

4. **OpenAI TTS**
   - Pricing: ~$15 per 1M characters
   - Good quality, simple API
   - No free tier

**Implementation Considerations**:
- Need to cache audio files to avoid repeated API calls
- Network latency for first-time narration
- Requires internet connection (offline mode not possible)
- Need to handle API errors/rate limits gracefully
- Cost considerations for heavy users
- Privacy: Text sent to third-party service

**Recommendation**: Start with Google Cloud TTS free tier to test concept, then evaluate based on usage patterns.

---

### Medium Priority
- [ ] **Hide transition error messages** - Filter "I didn't understand that sentence" after autorestore
- [ ] **Add "Restoring..." overlay** - Visual feedback during transition
- [ ] **Clear old autosaves** - Cleanup saves older than 30 days

### Low Priority
- [ ] **Autosave indicator** - Visual feedback when autosave occurs
- [ ] **Export/import saves** - Download/upload save files
- [ ] **Haptic feedback** - Add vibration on button press (mobile)

---

## 📚 Documentation

**Reference files:**
- `reference/save-restore-research.md` - Deep dive into ifvms.js/GlkOte
- `reference/design-decisions.md` - Text processing pipeline
- `reference/navigation-rules.md` - Playback controls behavior
- `CLAUDE.md` - Project instructions and architecture overview
