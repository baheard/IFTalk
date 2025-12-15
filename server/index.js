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
  console.log(`\n🎮 IFTalk running on http://localhost:${PORT}\n`);
});
