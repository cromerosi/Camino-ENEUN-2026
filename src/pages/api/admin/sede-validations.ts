import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { getAdminSessionCookieName, hasCampusAccess, verifyAdminSessionToken } from '../../../lib/admin-auth';

function getCampusFromQuery(queryCampus: string | string[] | undefined): string | null {
  const value = Array.isArray(queryCampus) ? queryCampus[0] : queryCampus;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);
  
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const sql = getSql();
  const requestedCampus = getCampusFromQuery(req.query.campus);

  if (req.method === 'GET') {
    try {
      const validations = await sql`
        SELECT id, campus, name, created_at
        FROM sede_validations
        ORDER BY created_at ASC
      `;

      const filtered = validations.filter((validation) => {
        const validationCampus = String((validation as { campus?: unknown }).campus ?? '');
        return hasCampusAccess(session, validationCampus);
      });

      return res.status(200).json({ validations: filtered });
    } catch (error) {
       console.error('Error fetching sede_validations (table might not exist):', error);
       return res.status(200).json({ validations: [], error: 'Table may not exist yet' });
    }
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const targetCampus = requestedCampus ?? session.campus;
    if (!targetCampus) {
      return res.status(400).json({ error: 'La sede objetivo es requerida' });
    }

    if (!hasCampusAccess(session, targetCampus)) {
      return res.status(403).json({ error: 'Sin permisos para crear validaciones en esta sede' });
    }

    try {
      const countRes = await sql`
        SELECT count(*) as count
        FROM sede_validations
        WHERE campus = ${targetCampus}
      `;
      const currentCount = parseInt(countRes[0].count, 10);
      if (currentCount >= 7) {
        return res.status(400).json({ error: 'Límite de 7 validaciones alcanzado' });
      }

      const inserted = await sql`
        INSERT INTO sede_validations (campus, name)
        VALUES (${targetCampus}, ${name.trim()})
        RETURNING id, name, created_at
      `;
      
      return res.status(201).json({ validation: inserted[0] });
    } catch (error) {
      console.error('Error inserting sede_validation:', error);
      return res.status(500).json({ error: 'Error interno o la tabla no existe en la base de datos.' });
    }
  }

  if (req.method === 'DELETE') {
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const validationId = Number(rawId);

    if (!Number.isInteger(validationId) || validationId <= 0) {
      return res.status(400).json({ error: 'ID de validación inválido' });
    }

    try {
      const existing = await sql`
        SELECT id, campus
        FROM sede_validations
        WHERE id = ${validationId}
        LIMIT 1
      `;

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Validación no encontrada' });
      }

      const validationCampus = String(existing[0].campus ?? '');
      if (!hasCampusAccess(session, validationCampus)) {
        return res.status(403).json({ error: 'Sin permisos para eliminar esta validación' });
      }

      await sql`
        DELETE FROM student_sede_validations
        WHERE validation_id = ${validationId}
      `;

      await sql`
        DELETE FROM sede_validations
        WHERE id = ${validationId}
          AND (
            campus = ${session.campus}
            OR translate(LOWER(campus), 'áéíóú', 'aeiou') = translate(LOWER(${session.campus ?? ''}), 'áéíóú', 'aeiou')
          )
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting sede_validation:', error);
      return res.status(500).json({ error: 'Error interno al eliminar la validación.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
