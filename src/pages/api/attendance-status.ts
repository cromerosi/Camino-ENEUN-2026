import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionCookieName, verifySignedSessionToken } from '../../lib/auth';
import { getAttendanceMatrixByEmail, type AttendanceMatrix } from '../../lib/participant';

const ATTENDANCE_DEBUG_ENABLED =
  process.env.DEBUG_ATTENDANCE_LOGS === 'true' || process.env.NODE_ENV !== 'production';

function maskForLogs(value: string): string {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function attendanceApiDebugLog(message: string, details?: Record<string, unknown>): void {
  if (!ATTENDANCE_DEBUG_ENABLED) {
    return;
  }

  if (details) {
    console.log(`[attendance-api] ${message}`, details);
    return;
  }

  console.log(`[attendance-api] ${message}`);
}

interface AttendanceCacheEntry {
  attendance: AttendanceMatrix;
  cachedAt: string;
}

const attendanceCache = new Map<string, AttendanceCacheEntry>();

const FALLBACK_ATTENDANCE: AttendanceMatrix = {
  totalSlots: 12,
  completedSlots: 0,
  lateSlots: 0,
  missingSlots: 0,
  slots: [
    { day: 'viernes', shift: 'manana', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'viernes', shift: 'manana', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'viernes', shift: 'tarde', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'viernes', shift: 'tarde', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'sabado', shift: 'manana', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'sabado', shift: 'manana', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'sabado', shift: 'tarde', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'sabado', shift: 'tarde', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'domingo', shift: 'manana', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'domingo', shift: 'manana', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'domingo', shift: 'tarde', type: 'entrada', status: 'unavailable', hourLabel: null, timestamp: null },
    { day: 'domingo', shift: 'tarde', type: 'salida', status: 'unavailable', hourLabel: null, timestamp: null },
  ],
  updatedAt: new Date().toISOString(),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    attendanceApiDebugLog('Incoming attendance request');

    const sessionToken = req.cookies[getSessionCookieName()];
    const authUser = await verifySignedSessionToken(sessionToken);

    if (!authUser?.email) {
      attendanceApiDebugLog('Request rejected: missing authorized user email');
      return res.status(401).json({ error: 'No autorizado' });
    }

    attendanceApiDebugLog('Authorized attendance request', {
      email: maskForLogs(authUser.email),
    });

    const attendance = await getAttendanceMatrixByEmail(authUser.email);

    attendanceApiDebugLog('Attendance payload ready', {
      email: maskForLogs(authUser.email),
      totalSlots: attendance.totalSlots,
      completedSlots: attendance.completedSlots,
      lateSlots: attendance.lateSlots,
      missingSlots: attendance.missingSlots,
    });

    attendanceCache.set(authUser.email.toLowerCase(), {
      attendance,
      cachedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      attendance,
      timestamp: new Date().toISOString(),
      stale: false,
    });
  } catch (error) {
    console.error('Error in /api/attendance-status:', error);
    attendanceApiDebugLog('Attendance request failed; attempting cache fallback', {
      error: error instanceof Error ? error.message : 'unknown error',
    });

    const sessionToken = req.cookies[getSessionCookieName()];
    const authUser = await verifySignedSessionToken(sessionToken).catch(() => null);
    const cacheKey = authUser?.email?.toLowerCase() ?? '';

    if (cacheKey) {
      const cached = attendanceCache.get(cacheKey);
      if (cached) {
        attendanceApiDebugLog('Returning cached stale attendance', {
          email: maskForLogs(cacheKey),
          staleFrom: cached.cachedAt,
        });
        return res.status(200).json({
          attendance: cached.attendance,
          timestamp: new Date().toISOString(),
          stale: true,
          staleFrom: cached.cachedAt,
          warning: 'Mostrando última lectura disponible por conexión temporalmente inestable.',
        });
      }
    }

    return res.status(200).json({
      attendance: FALLBACK_ATTENDANCE,
      timestamp: new Date().toISOString(),
      stale: true,
      warning: 'Sin conexión temporal con base de datos. Mostrando estado degradado.',
    });
  }
}
