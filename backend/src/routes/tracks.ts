import { FastifyInstance } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import fs from 'fs';
import path from 'path';
import { getSessionByCode, createTrack, updateTrack, deleteTrack, getTracksBySession } from '../db';
import { Track } from '../types';
import { getIo } from '../io';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

export async function trackRoutes(app: FastifyInstance) {
  app.post<{ Params: { code: string } }>('/sessions/:code/tracks', async (req, reply) => {
    const session = getSessionByCode(req.params.code);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const parts = req.parts();
    let filePart: MultipartFile | null = null;
    let metadata: Partial<Track> = {};

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        filePart = part;
        // Buffer the file before processing metadata (parts are ordered: metadata first, file second)
        // We need to drain the file part — collect it
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        (part as MultipartFile & { _buf: Buffer })._buf = Buffer.concat(chunks);
      } else if (part.type === 'field' && part.fieldname === 'metadata') {
        try {
          metadata = JSON.parse(part.value as string);
        } catch {
          return reply.status(400).send({ error: 'Invalid metadata JSON' });
        }
      }
    }

    if (!filePart) return reply.status(400).send({ error: 'Missing file' });
    if (!metadata.id) return reply.status(400).send({ error: 'Missing track id in metadata' });

    const sessionDir = path.join(UPLOADS_DIR, session.id);
    fs.mkdirSync(sessionDir, { recursive: true });

    const filename = `${metadata.id}.webm`;
    const filePath = path.join(sessionDir, filename);
    const buf = (filePart as MultipartFile & { _buf: Buffer })._buf;
    fs.writeFileSync(filePath, buf);

    const audioUrl = `/uploads/${session.id}/${filename}`;
    const track = createTrack(
      metadata.id,
      session.id,
      metadata.name ?? `Track`,
      audioUrl,
      metadata.startTime ?? 0,
      metadata.volume ?? 0.8,
      metadata.color ?? '#ff7043',
      metadata.enabled !== false
    );

    // Notify all sockets in this session room
    getIo().to(session.id).emit('track:added', { track });

    reply.status(201).send({ track });
  });

  app.patch<{
    Params: { code: string; trackId: string };
    Body: Partial<Pick<Track, 'startTime' | 'volume' | 'enabled' | 'name' | 'color'>>;
  }>('/sessions/:code/tracks/:trackId', async (req, reply) => {
    const session = getSessionByCode(req.params.code);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const track = updateTrack(req.params.trackId, session.id, req.body);
    if (!track) return reply.status(404).send({ error: 'Track not found' });

    reply.send({ track });
  });

  app.delete<{ Params: { code: string; trackId: string } }>(
    '/sessions/:code/tracks/:trackId',
    async (req, reply) => {
      const session = getSessionByCode(req.params.code);
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const deleted = deleteTrack(req.params.trackId, session.id);
      if (!deleted) return reply.status(404).send({ error: 'Track not found' });

      const filePath = path.join(UPLOADS_DIR, session.id, `${req.params.trackId}.webm`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      reply.status(204).send();
    }
  );
}
