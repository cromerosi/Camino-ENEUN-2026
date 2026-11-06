import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql, withTransaction } from '../../../lib/db';
import { hasCampusAccess, hasMultipleCampusScope } from '../../../lib/admin-auth';
import { methodNotAllowed, requireAdminSession } from '../../../lib/admin-api';
import { getQueryValue, isPlainObject, parsePositiveInteger } from '../../../lib/http';

const MAX_VALIDATIONS_PER_CAMPUS = 7;
const MAX_VALIDATION_NAME_LENGTH = 120;

interface ValidationRow {
  id: number;
  campus: string | null;
  name: string;
  created_at: string | Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  const sql = getSql();

  if (req.method === 'GET') {
    try {
      const validations = (await sql`
        SELECT id, campus, name, created_at
        FROM sede_validations
        ORDER BY created_at ASC
      `) as ValidationRow[];

      const filtered = validations.filter((validation) => hasCampusAccess(session, validation.campus));
      return res.status(200).json({ validations: filtered });
    } catch (error) {
      console.error('Error fetching sede_validations (table might not exist):', error);
      return res.status(200).json({ validations: [], error: 'Table may not exist yet' });
    }
  }

  if (req.method === 'POST') {
    const body = isPlainObject(req.body) ? req.body : {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (name.length > MAX_VALIDATION_NAME_LENGTH) {
      return res.status(400).json({ error: `El nombre no puede superar ${MAX_VALIDATION_NAME_LENGTH} caracteres` });
    }

    // Los admins de una sola sede crean en su sede; los multisede/globales deben indicarla.
    const requestedCampus = getQueryValue(req.query.campus);
    const targetCampus = requestedCampus || (hasMultipleCampusScope(session) ? '' : session.campus);
    if (!targetCampus) {
      return res.status(400).json({ error: 'Selecciona la sede de la validación' });
    }

    if (!hasCampusAccess(session, targetCampus)) {
      return res.status(403).json({ error: 'Sin permisos para crear validaciones en esta sede' });
    }

    try {
      const countRows = (await sql`
        SELECT count(*)::int AS count
        FROM sede_validations
        WHERE translate(lower(trim(campus)), 'áéíóúü', 'aeiouu')
          = translate(lower(trim(${targetCampus})), 'áéíóúü', 'aeiouu')
      `) as Array<{ count: number }>;

      if (Number(countRows[0]?.count ?? 0) >= MAX_VALIDATIONS_PER_CAMPUS) {
        return res.status(400).json({ error: `Límite de ${MAX_VALIDATIONS_PER_CAMPUS} validaciones alcanzado` });
      }

      const inserted = (await sql`
        INSERT INTO sede_validations (campus, name)
        VALUES (${targetCampus}, ${name})
        RETURNING id, campus, name, created_at
      `) as ValidationRow[];

      return res.status(201).json({ validation: inserted[0] });
    } catch (error) {
      console.error('Error inserting sede_validation:', error);
      return res.status(500).json({ error: 'Error interno o la tabla no existe en la base de datos.' });
    }
  }

  if (req.method === 'DELETE') {
    const validationId = parsePositiveInteger(getQueryValue(req.query.id));
    if (!validationId) {
      return res.status(400).json({ error: 'ID de validación inválido' });
    }

    try {
      const existing = (await sql`
        SELECT id, campus
        FROM sede_validations
        WHERE id = ${validationId}
        LIMIT 1
      `) as Array<{ id: number; campus: string | null }>;

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Validación no encontrada' });
      }

      if (!hasCampusAccess(session, existing[0].campus)) {
        return res.status(403).json({ error: 'Sin permisos para eliminar esta validación' });
      }

      // En una transacción para no dejar estados huérfanos si algo falla.
      await withTransaction(async (tx) => {
        await tx`
          DELETE FROM student_sede_validations
          WHERE validation_id = ${validationId}
        `;
        await tx`
          DELETE FROM sede_validations
          WHERE id = ${validationId}
        `;
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting sede_validation:', error);
      return res.status(500).json({ error: 'Error interno al eliminar la validación.' });
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
}
