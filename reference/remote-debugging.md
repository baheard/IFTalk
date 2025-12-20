# Remote Debugging (iOS/Mobile)

Debug console logs from mobile devices where dev tools aren't available.

## Setup

Uses [BetterStack LogTail](https://betterstack.com/logtail) for remote log collection.

### Configuration

File: `docs/js/utils/remote-console.js`

```javascript
const LOGTAIL_TOKEN = 'your-source-token';
const LOGTAIL_ENDPOINT = 'https://your-host.betterstackdata.com';
const LOCAL_SERVER = false;
```

### Getting Your Credentials

1. Sign up at https://betterstack.com/logtail (free tier: 1GB/month)
2. Click **"Connect source"** → **"JavaScript"**
3. Copy the **Source token** and **Ingesting host** from your source settings
4. Update `remote-console.js` with both values

**Important:** New BetterStack sources (after Feb 2025) use custom endpoints like `s123.eu-nbg-2.betterstackdata.com`, not the legacy `in.logs.betterstack.com`.

## Usage

### Automatic Logging (when enabled)

All `console.log`, `warn`, `error`, `info`, `debug` calls are sent to LogTail automatically when `LOGTAIL_TOKEN` is set.

### Manual Remote Logging

Use `console.remote()` to always send to LogTail, regardless of configuration:

```javascript
console.remote('Debug info', { state: someValue });
console.remote('Error occurred', error);
```

- Shows as `[REMOTE]` prefix in local console
- Always sends to LogTail if token is configured
- Useful for targeted debugging in local dev (accessing via phone on LAN)

### Unhandled Errors

Automatically captures:
- Uncaught exceptions (`window.onerror`)
- Unhandled promise rejections

## Viewing Logs

1. Go to LogTail dashboard
2. Click **"Live tail"** for real-time logs
3. Filter by:
   - `level: error` - errors only
   - `level: remote` - manual `console.remote()` calls
   - `userAgent: iPhone` - iOS devices only

## Local Server Logging (Optional)

For local development without LogTail:

1. Set `LOCAL_SERVER = true` in `remote-console.js`
2. Run `npm start` - logs appear in your terminal with colors
3. Access from phone via local IP (e.g., `http://192.168.1.x:3000`)

Server endpoint: `POST /api/log` (defined in `server/core/app.js`)
