import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import {
  createSession,
  getSessionByCode,
  deleteSession,
  getTracksBySession,
  isCodeTaken,
  updateSessionName,
} from '../db';
import { getIo } from '../io';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function freshCode(): string {
  let code = generateCode();
  let attempts = 0;
  while (isCodeTaken(code) && attempts < 10) {
    code = generateCode();
    attempts++;
  }
  return code;
}

export async function sessionRoutes(app: FastifyInstance) {
  app.post<{ Body: { name?: string } }>('/sessions', async (req, reply) => {
    const id = uuidv4();
    const code = freshCode();
    const name = req.body?.name ?? null;
    const session = createSession(id, code, name);
    reply.status(201).send(session);
  });

  app.get<{ Params: { code: string } }>('/sessions/:code', async (req, reply) => {
    const session = getSessionByCode(req.params.code);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const tracks = getTracksBySession(session.id);
    reply.send({ session, tracks });
  });

  app.patch<{ Params: { code: string }; Body: { name: string } }>(
    '/sessions/:code',
    async (req, reply) => {
      const session = getSessionByCode(req.params.code);
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const name = (req.body?.name ?? '').trim().slice(0, 100);
      updateSessionName(session.id, name);

      getIo().to(session.id).emit('session:nameUpdated', { name });
      reply.send({ name });
    }
  );

  app.delete<{ Params: { code: string } }>('/sessions/:code', async (req, reply) => {
    const session = getSessionByCode(req.params.code);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const sessionUploadsDir = path.join(UPLOADS_DIR, session.id);
    if (fs.existsSync(sessionUploadsDir)) {
      fs.rmSync(sessionUploadsDir, { recursive: true, force: true });
    }

    deleteSession(session.id);
    reply.status(204).send();
  });
}
