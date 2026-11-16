import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocketServer } from './services/socket.js';
import { emailService } from './services/email/mailer.js';
import { initializeMasterAdmin } from './services/admin/adminInit.service.js';

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

  // Ensure Master Admin account integrity and purge legacy demo admin
  initializeMasterAdmin().catch((err) => {
    console.error('Failed to initialize Master Admin:', err);
  });

  // Verify Email Service Connection on startup (Brevo REST API or Gmail SMTP)
  emailService.verifyConnection().catch((err) => {
    if (env.NODE_ENV === 'production') {
      console.error('❌ [FATAL] Email service verification failed in production:', err);
    }
  });
});
