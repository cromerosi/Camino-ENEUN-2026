import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { canAccessAllCampuses, hasCampusAccess } from '../../../lib/admin-auth';
import { methodNotAllowed, requireAdminSession } from '../../../lib/admin-api';
import { isPlainObject, parsePositiveInteger } from '../../../lib/http';

interface StudentRow {
  registration_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  document_number: string | null;
  campus: string | null;
  validations: Array<{ validation_id: number; is_completed: boolean }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  const sql = getSql();

  if (req.method === 'GET') {
    try {
      // DISTINCT ON evita filas repetidas si un estudiante tiene varias
      // preconfirmaciones registradas para la misma sede.
      const students = (await sql`
        SELECT *
        FROM (
          SELECT DISTINCT ON (r.id, c.campus)
            r.id AS registration_id,
            r.first_name,
            r.last_name,
            r.email,
            r.document_number,
            c.campus,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'validation_id', ssv.validation_id,
                    'is_completed', ssv.is_completed
                  )
                )
                FROM student_sede_validations ssv
                WHERE ssv.registration_id = r.id
              ),
              '[]'::json
            ) AS validations
          FROM registrations r
          JOIN confirmation_submissions c ON c.registration_id = r.id
          ORDER BY r.id, c.campus
        ) s
        ORDER BY s.last_name ASC, s.first_name ASC
      `) as StudentRow[];

      const filteredStudents = canAccessAllCampuses(session)
        ? students
        : students.filter((student) => hasCampusAccess(session, student.campus));

      return res.status(200).json({ students: filteredStudents });
    } catch (error) {
      console.error('Error fetching students or validations (table may not exist):', error);
      // Se devuelve un arreglo vacío para no romper la interfaz si faltan tablas.
      return res.status(200).json({ students: [], error: 'Tables might be missing' });
    }
  }

  if (req.method === 'POST') {
    const body = isPlainObject(req.body) ? req.body : {};
    const registrationId = parsePositiveInteger(body.registration_id);
    const validationId = parsePositiveInteger(body.validation_id);
    const isCompleted = body.is_completed;

    if (!registrationId || !validationId || typeof isCompleted !== 'boolean') {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    try {
      const scopeRows = (await sql`
        SELECT c.campus
        FROM registrations r
        JOIN confirmation_submissions c
          ON c.registration_id = r.id
        JOIN sede_validations sv
          ON sv.id = ${validationId}
        WHERE r.id = ${registrationId}
          AND (
            c.campus = sv.campus
            OR translate(lower(trim(c.campus)), 'áéíóúü', 'aeiouu') = translate(lower(trim(sv.campus)), 'áéíóúü', 'aeiouu')
          )
        LIMIT 1
      `) as Array<{ campus: string | null }>;

      if (scopeRows.length === 0) {
        return res.status(400).json({ error: 'Registro o validación inválidos para una misma sede' });
      }

      if (!hasCampusAccess(session, scopeRows[0].campus)) {
        return res.status(403).json({ error: 'Sin permisos para modificar esta sede' });
      }

      await sql`
        INSERT INTO student_sede_validations (registration_id, validation_id, is_completed)
        VALUES (${registrationId}, ${validationId}, ${isCompleted})
        ON CONFLICT (registration_id, validation_id)
        DO UPDATE SET is_completed = EXCLUDED.is_completed, updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating validation status:', error);
      return res.status(500).json({ error: 'Error interno o tabla no existe' });
    }
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
