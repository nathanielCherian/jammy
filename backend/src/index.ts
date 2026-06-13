import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { sessionRoutes } from './routes/sessions';
import { trackRoutes } from './routes/tracks';
import { setupSocket } from './socket';
import { setIo } from './io';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function start() {
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  await app.register(staticFiles, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  });

  await app.register(sessionRoutes);
  await app.register(trackRoutes);

  await app.listen({ port: PORT, host: '0.0.0.0' });

  // Attach Socket.IO to Fastify's underlying HTTP server after listen
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:4173'],
    },
  });

  setIo(io);
  setupSocket(io);

  console.log(`Jammy backend running on http://localhost:${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
