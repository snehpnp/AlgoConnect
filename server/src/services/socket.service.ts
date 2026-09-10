import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SocketService {
  private static io: SocketIOServer;

  // Mapping of userId (string) to their active socketId
  private static userSockets: Map<string, string> = new Map();

  static initialize(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      // console.log(`[Socket] User connected: ${socket.id}`);

      // When a user authenticates/connects from frontend, they emit "register"
      socket.on('register', (userId: number) => {
        if (userId) {
          socket.join(userId.toString());
          // console.log(`[Socket] Registered User ${userId} into room ${userId.toString()}`);
        }
      });

      socket.on('disconnect', () => {
        // console.log(`[Socket] User disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Emit an event to a specific user
   */
  static sendToUser(userId: number, event: string, payload: any) {
    if (!this.io) {
      // console.warn('[Socket] Attempted to send without initialized socket.io');
      return;
    }
    this.io.to(userId.toString()).emit(event, payload);
  }

  /**
   * Emit an event to everyone
   */
  static broadcast(event: string, payload: any) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }
}
