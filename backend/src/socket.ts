import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getSessionByCode, getTracksBySession, updateTrack, deleteTrack } from './db';
import { Track } from './types';

export function setupSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    let currentSessionId: string | null = null;
    let userId: string = uuidv4();

    socket.on('join', async ({ code }: { code: string }) => {
      const session = getSessionByCode(code);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      currentSessionId = session.id;
      await socket.join(session.id);

      const tracks = getTracksBySession(session.id);
      const onlineCount = (await io.in(session.id).fetchSockets()).length;

      socket.emit('session:state', { session, tracks, userId, onlineCount });
      socket.to(session.id).emit('user:joined', { userId, onlineCount });
    });

    socket.on(
      'track:update',
      ({ trackId, changes }: { trackId: string; changes: Partial<Track> }) => {
        if (!currentSessionId) return;
        // Persist to DB (best-effort) then always relay — pre-loaded tracks
        // may not be in the DB yet until the integration phase migrates them.
        updateTrack(trackId, currentSessionId, changes);
        socket.to(currentSessionId).emit('track:updated', { trackId, changes });
      }
    );

    socket.on('track:delete', ({ trackId }: { trackId: string }) => {
      if (!currentSessionId) return;
      deleteTrack(trackId, currentSessionId);
      socket.to(currentSessionId).emit('track:deleted', { trackId });
    });

    socket.on('disconnect', async () => {
      if (!currentSessionId) return;

      const onlineCount = (await io.in(currentSessionId).fetchSockets()).length;
      io.to(currentSessionId).emit('user:left', { userId, onlineCount });
    });
  });
}
