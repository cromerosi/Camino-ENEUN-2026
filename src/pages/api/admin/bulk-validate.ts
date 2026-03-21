import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import {
  getAdminSessionCookieName,
  hasCampusAccess,
  verifyAdminSessionToken,
} from '../../../lib/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { registration_ids, validation_id, is_completed } = req.body;

  if (!Array.isArray(registration_ids) || !validation_id || is_completed === undefined) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (registration_ids.length === 0) {
    return res.status(200).json({ success: true, count: 0 });
  }

  const sql = getSql();

  try {
    // Fetch validation's campus to verify admin has access
    const validationRows = await sql`
      SELECT campus FROM sede_validations WHERE id = ${validation_id} LIMIT 1
    `;

    if (validationRows.length === 0) {
      return res.status(400).json({ error: 'Validación no encontrada' });
    }

    const targetCampus = String(validationRows[0].campus ?? '');
    if (!hasCampusAccess(session, targetCampus)) {
      return res.status(403).json({ error: 'Sin permisos para modificar esta sede' });
    }

    // Verify all registration_ids belong to this campus
    const studentRows = await sql`
      SELECT r.id
      FROM registrations r
      JOIN confirmation_submissions c ON c.registration_id = r.id
      WHERE r.id = ANY(${registration_ids}::int[])
        AND c.campus = ${targetCampus}
    `;

    const allowedIds = (studentRows as unknown as { id: number }[]).map((r) => r.id);

    if (allowedIds.length === 0) {
      return res.status(400).json({ error: 'Ningún estudiante pertenece a esta sede' });
    }

    // Bulk upsert
    const insertData = allowedIds.map((id: number) => ({
      registration_id: id,
      validation_id: Number(validation_id),
      is_completed: Boolean(is_completed),
    }));

    await sql`
      INSERT INTO student_sede_validations ${sql(insertData, 'registration_id', 'validation_id', 'is_completed')}
      ON CONFLICT (registration_id, validation_id)
      DO UPDATE SET is_completed = EXCLUDED.is_completed, updated_at = NOW()
    `;

    return res.status(200).json({ success: true, count: allowedIds.length });
  } catch (error) {
    console.error('Error bulk updating validation status:', error);
    return res.status(500).json({ error: 'Error interno o tabla no existe' });
  }
}
