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
  console.log(`✅ Server running with HTTPS!`);
  console.log(`\n📱 Access from:`);
  console.log(`   This computer:  https://localhost:${PORT}`);
  console.log(`   Your phone:     https://${localIP}:${PORT}`);
  console.log(`   (Make sure phone is on same WiFi)\n`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
