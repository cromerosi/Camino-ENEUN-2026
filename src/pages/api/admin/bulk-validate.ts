import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { hasCampusAccess } from '../../../lib/admin-auth';
import { methodNotAllowed, requireAdminSession } from '../../../lib/admin-api';
import { isPlainObject, parsePositiveInteger } from '../../../lib/http';

const MAX_BULK_SIZE = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const body = isPlainObject(req.body) ? req.body : {};
  const validationId = parsePositiveInteger(body.validation_id);
  const isCompleted = body.is_completed;

  if (!Array.isArray(body.registration_ids) || !validationId || typeof isCompleted !== 'boolean') {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const registrationIds = Array.from(
    new Set(
      body.registration_ids
        .map((value) => parsePositiveInteger(value))
        .filter((value): value is number => value !== null),
    ),
  );

  if (registrationIds.length === 0) {
    return res.status(200).json({ success: true, count: 0 });
  }

  if (registrationIds.length > MAX_BULK_SIZE) {
    return res.status(400).json({ error: `Máximo ${MAX_BULK_SIZE} estudiantes por operación` });
  }

  const sql = getSql();

  try {
    // Se verifica que el admin tenga acceso a la sede de la validación.
    const validationRows = (await sql`
      SELECT campus FROM sede_validations WHERE id = ${validationId} LIMIT 1
    `) as Array<{ campus: string | null }>;

    if (validationRows.length === 0) {
      return res.status(400).json({ error: 'Validación no encontrada' });
    }

    const targetCampus = String(validationRows[0].campus ?? '');
    if (!hasCampusAccess(session, targetCampus)) {
      return res.status(403).json({ error: 'Sin permisos para modificar esta sede' });
    }

    // Solo se actualizan los estudiantes que pertenecen a la sede de la validación.
    const studentRows = (await sql`
      SELECT DISTINCT r.id
      FROM registrations r
      JOIN confirmation_submissions c ON c.registration_id = r.id
      WHERE r.id = ANY(${registrationIds}::int[])
        AND (
          c.campus = ${targetCampus}
          OR translate(lower(trim(c.campus)), 'áéíóúü', 'aeiouu') = translate(lower(trim(${targetCampus})), 'áéíóúü', 'aeiouu')
        )
    `) as Array<{ id: number }>;

    const allowedIds = studentRows.map((row) => row.id);

    if (allowedIds.length === 0) {
      return res.status(400).json({ error: 'Ningún estudiante pertenece a esta sede' });
    }

    const insertData = allowedIds.map((id) => ({
      registration_id: id,
      validation_id: validationId,
      is_completed: isCompleted,
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
