import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TokenPayload } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

let io: Server | null = null;

export function initSocketServer(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    
cors: {
  origin: [
    env.CORS_ORIGIN,
    'https://repair-hub-ecru.vercel.app',
    'https://repairhub-mobile-frontend.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
},

  });

  // JWT Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : null);

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) return;

    const { userId, role } = socket.user;

    // Join personal user notification room
    socket.join(`user:${userId}`);

    // Admins join role:admin
    if (role === 'ADMIN') {
      socket.join('role:admin');
    }

    // Client can join a specific request room to receive live updates
    socket.on('request:join', (requestId: string) => {
      socket.join(`request:${requestId}`);
    });

    socket.on('request:leave', (requestId: string) => {
      socket.leave(`request:${requestId}`);
    });

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

export function emitRequestUpdated(requestId: string, payload: any): void {
  if (!io) return;
  // Emit to viewers of the request room
  io.to(`request:${requestId}`).emit('request:updated', payload);
  // Also emit to all admins
  io.to('role:admin').emit('request:updated', payload);

  // If customerId is provided, also emit to their personal room
  if (payload.customerId) {
    io.to(`user:${payload.customerId}`).emit('request:updated', payload);
  }
  // If mechanicId is provided, also emit to mechanic's personal room
  if (payload.mechanicId) {
    io.to(`user:${payload.mechanicId}`).emit('request:updated', payload);
  }
}

export function emitNotification(userId: string, notification: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}
