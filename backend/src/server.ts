import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocketServer } from './services/socket.js';

const app = createApp();
const server = http.createServer(app);

// Initialize real-time Socket.IO server
initSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 RepairHub Backend running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Healthcheck: http://localhost:${env.PORT}/health`);
  console.log(`===============================================`);
});
