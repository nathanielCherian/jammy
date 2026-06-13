import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSessionByCode, createTrack, updateTrack, deleteTrack } from '../db';
import { Track } from '../types';
import { getIo } from '../io';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

export async function trackRoutes(app: FastifyInstance) {
  app.post<{ Params: { code: string } }>('/sessions/:code/tracks', async (req, reply) => {
    const session = getSessionByCode(req.params.code);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    // Consume ALL parts before any early return — exiting a for-await loop
    // early without draining the stream causes the connection to hang.
    let fileBuffer: Buffer | null = null;
    let metadata: Partial<Track> = {};
    let metadataParseError = false;

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
      } else if (part.type === 'field' && part.fieldname === 'metadata') {
        try {
          metadata = JSON.parse(part.value as string);
        } catch {
          metadataParseError = true;
        }
      }
    }

    if (metadataParseError) return reply.status(400).send({ error: 'Invalid metadata JSON' });
    if (!fileBuffer) return reply.status(400).send({ error: 'Missing file' });

    const trackId = uuidv4();
    const sessionDir = path.join(UPLOADS_DIR, session.id);
    fs.mkdirSync(sessionDir, { recursive: true });

    const filename = `${trackId}.webm`;
    fs.writeFileSync(path.join(sessionDir, filename), fileBuffer);

    const audioUrl = `/uploads/${session.id}/${filename}`;
    const track = createTrack(
      trackId,
      session.id,
      metadata.name ?? 'Track',
      audioUrl,
      metadata.startTime ?? 0,
      metadata.volume ?? 0.8,
      metadata.color ?? '#ff7043',
      metadata.enabled !== false
    );

    const socketId = (metadata as { socketId?: string }).socketId;
    const io = getIo();
    const target = socketId ? io.to(session.id).except(socketId) : io.to(session.id);
    target.emit('track:added', { track });
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
