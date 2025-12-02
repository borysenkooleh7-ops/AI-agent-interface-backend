import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

interface DecodedToken {
  userId: string;
  email: string;
  role: string;
}

export function setupSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
      (socket as any).userId = decoded.userId;
      (socket as any).userEmail = decoded.email;
      (socket as any).userRole = decoded.role;

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const userEmail = (socket as any).userEmail;

    logger.info(`User connected via Socket.IO: ${userEmail} (${userId})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      if (!conversationId) return;
      logger.info(`Socket joining conversation room`, { userId, conversationId });
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      if (!conversationId) return;
      logger.info(`Socket leaving conversation room`, { userId, conversationId });
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on('message:typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (!data?.conversationId) return;
      socket.to(`conversation:${data.conversationId}`).emit('message:typing', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userEmail} (${userId})`);
    });

    // Handle notification read event
    socket.on('notification:read', (data) => {
      logger.info(`Notification ${data.notificationId} marked as read by ${userId}`);
      // Emit to user's other connected devices
      socket.to(`user:${userId}`).emit('notification:read', data);
    });

    // Handle mark all as read event
    socket.on('notifications:read-all', () => {
      logger.info(`All notifications marked as read by ${userId}`);
      // Emit to user's other connected devices
      socket.to(`user:${userId}`).emit('notifications:read-all');
    });
  });

  return io;
}

// Helper function to emit notification to specific user
export function emitNotificationToUser(io: SocketIOServer, userId: string, notification: any) {
  io.to(`user:${userId}`).emit('notification', notification);
  logger.info(`Notification emitted to user ${userId}: ${notification.title}`);
}

// Helper function to emit notification to multiple users
export function emitNotificationToUsers(io: SocketIOServer, userIds: string[], notification: any) {
  userIds.forEach(userId => {
    emitNotificationToUser(io, userId, notification);
  });
}

// Helper function to broadcast system notification to all users
export function broadcastSystemNotification(io: SocketIOServer, notification: any) {
  io.emit('system-notification', notification);
  logger.info(`System notification broadcasted: ${notification.title}`);
}

