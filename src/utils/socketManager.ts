import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketInstance(): SocketIOServer | null {
  return ioInstance;
}

