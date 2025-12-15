/**
 * IFTalk Server Entry Point
 *
 * Main server initialization and startup.
 */

import { createApp, getLocalIP } from './core/app.js';
import { config } from './core/config.js';

const { app, httpServer, io } = createApp();

// Start server
const PORT = config.port || 3000;

httpServer.listen(PORT, async () => {
  const localIP = await getLocalIP();

  console.log('\n🎮 IF Talk - Voice-Powered Interactive Fiction\n');
  console.log(`✅ Server running!`);
  console.log(`\n📱 Access from:`);
  console.log(`   This computer:  http://localhost:${PORT}`);
  console.log(`   Your phone:     http://${localIP}:${PORT}`);
  console.log(`   (Make sure phone is on same WiFi)\n`);
  console.log(`🔊 Voice: ${config.voice.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🎮 Frotz: ${config.interpreter} ${config.interpreterArgs.join(' ')}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
