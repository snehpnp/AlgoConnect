"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
class SocketService {
    static io;
    // Mapping of userId (string) to their active socketId
    static userSockets = new Map();
    static initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: true,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        this.io.on('connection', (socket) => {
            // console.log(`[Socket] User connected: ${socket.id}`);
            // When a user authenticates/connects from frontend, they emit "register"
            socket.on('register', (userId) => {
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
    static sendToUser(userId, event, payload) {
        if (!this.io) {
            // console.warn('[Socket] Attempted to send without initialized socket.io');
            return;
        }
        this.io.to(userId.toString()).emit(event, payload);
    }
    /**
     * Emit an event to everyone
     */
    static broadcast(event, payload) {
        if (this.io) {
            this.io.emit(event, payload);
        }
    }
}
exports.SocketService = SocketService;
