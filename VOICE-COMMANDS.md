# Voice Commands Reference

## Voice Control Modes

### Continuous Listening Mode
Click **"🎤 Start Listening"** to enable hands-free voice control.

**Features:**
- 🎚️ **Live voice meter** - See mic input level
- 💬 **Live transcript** - See words as you speak
- 🔄 **Auto-restart** - Listens again after each command
- ⏱️ **Fast** - 300ms delay after you stop speaking

### Push-to-Talk Mode
Enable in settings for car Bluetooth environments where continuous listening causes audio quality issues.

**Features:**
- Hold the mic button to speak
- Recognition only active while button is held
- Prevents audio feedback loops
- Ideal for car stereo systems

## Recognition Behavior

### Tab Switching
When you switch browser tabs:
- Voice recognition automatically stops
- Any partial (interim) text is sent as a **0% confidence command**
- Recognition auto-restarts when you return to the tab
- Ensures no speech is lost during tab switches

### Auto-Unmute on Narration
When you press **"▶️ Start Narration"**:
- Microphone automatically unmutes (if not in push-to-talk mode)
- Allows you to speak commands during narration
- **Exception**: If you manually muted the mic, it stays muted (respects your choice)

### Confidence Levels
Voice recognition includes confidence scores:
- **High confidence (≥50%)** - Command executes normally
- **Low confidence (<50%)** - Command displays but doesn't execute (visual feedback only)
- **0% confidence** - Partial/interrupted speech (shown in gray with "0%" label)

Low confidence commands are shown so you can manually type them if needed.

## Voice Commands

### Game Commands (When NOT Narrating)

| Command | Action | Example |
|---------|--------|---------|
| **"Next"** or **"Enter"** | Press Enter (empty command) | "next" |
| **"Resume"** or **"Play"** | Start/resume narration | "resume" |
| **"Print [text]"** | Send literal text to game | "print go" → sends "go" |
| **Anything else** | AI translates to game command | "look around" → LOOK |

### Narration Commands (During Narration)

| Command | Action | Description |
|---------|--------|-------------|
| **"Skip"** | Skip current sentence | Jumps to next sentence |
| **"Skip all"** | Skip to end | Stops all narration |
| **"Pause"** | Pause narration | Resume with button or voice |

**All other speech is ignored during narration** to prevent accidental commands!

## Navigation Controls

### Buttons
- ⏮️ **Skip to Beginning** - Go to first sentence
- ◀️ **Previous** - Go back one sentence
- ▶️ **Next** - Go forward one sentence
- ⏭️ **Skip to End** - Jump to last sentence

### Keyboard
- **Arrow Left** - Previous sentence
- **Arrow Right** - Next sentence
- **Escape** - Pause narration

## Narration Control

### Start Narration Button
- **"▶️ Start Narration"** - Begin reading
- **"⏸️ Pause"** - Pause at current position
- **"▶️ Resume"** - Continue from where you paused

Shows position: `(3/10)` = sentence 3 of 10

## Special Features

### Dual Voice System
- **Normal voice** (`RexqLjNzkCjWogguKyff`) - Game narrative
- **Instruction voice** (`pNInz6obpgDQGcFmaJgB`) - Text in `[brackets]`

Bracket text uses a different voice to distinguish instructions from narrative!

### Text Processing
- **ANCHORHEAD** - Spaced titles condensed and read as one word
- **H.P. Lovecraft** - Author attributions skipped
- **[Press 'R' to restore...]** - Instructions read with instruction voice
- **Dots and artifacts** - Cleaned from display

## Example Session

```
You: Click "🎤 Start Listening"
App: [Shows voice meter and live transcript]

You: "I want to look around"
Transcript: [Shows: "I want to look around" in real-time]
App: → Translates to "LOOK" → Sends to game

You: Click "▶️ Start Narration"
App: [Reads game response with main voice]
App: [Reads "[Press any key]" with instruction voice]

You: "Skip"
App: [Skips to next sentence]

You: "Skip all"
App: [Stops narration]

You: "Next"
App: → Sends empty command (presses Enter)
```

## Tips

### For Best Voice Recognition
1. **Speak clearly** but naturally
2. **Quiet environment** helps
3. **Headset microphone** works best
4. **Watch the voice meter** - speak when it's bouncing

### For Long Narrations
1. **Start narration** - Let it read
2. **Use ◀️/▶️** to navigate while paused
3. **Say "Skip"** to jump ahead
4. **Say "Pause"** to stop and resume later

### Keyboard vs Voice
- **Keyboard** - Faster for experienced IF players
- **Voice** - More immersive, hands-free
- **Mix both** - Use what feels natural!

## Available Voice Commands Summary

**App Control:**
- "Skip" (during narration)
- "Skip all" (during narration)
- "Pause" (during narration)
- "Resume" / "Play" (when paused)
- "Next" / "Enter" (press Enter)
- "Print [text]" (literal text)

**Game Commands:**
- Everything else gets AI-translated!
- "Look around" → LOOK
- "Go north" → N
- "Take the key" → TAKE KEY
- etc.

## Voice Settings

Edit `config.json` to customize:
```json
{
  "voice": {
    "enabled": true,
    "tts": {
      "method": "browser",
      "browser": {
        "voice": "Google UK English Male",
        "appVoice": "Google US English",
        "rate": 1.1,
        "pitch": 1.0
      }
    }
  }
}
```

Browse available voices in your browser's Settings → Accessibility → Text-to-Speech

---

**Enjoy hands-free, voice-controlled interactive fiction!** 🎮🎤🔊
