import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import {
  canAccessAllCampuses,
  getAdminSessionCookieName,
  hasCampusAccess,
  verifyAdminSessionToken,
} from '../../../lib/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);
  
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const sql = getSql();

  if (req.method === 'GET') {
    try {
      const students = await sql`
        SELECT 
          r.id as registration_id, 
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
          ) as validations
        FROM registrations r
        JOIN confirmation_submissions c ON c.registration_id = r.id
        ORDER BY r.last_name ASC, r.first_name ASC
      `;

      const filteredStudents = canAccessAllCampuses(session)
        ? students
        : students.filter((student) => hasCampusAccess(session, String(student.campus ?? '')));

      return res.status(200).json({ students: filteredStudents });
    } catch (error) {
       console.error('Error fetching students or validations (table may not exist):', error);
       // Return empty array to not crash the UI if DB tables are pending creation
       return res.status(200).json({ students: [], error: 'Tables might be missing' });
    }
  }

  if (req.method === 'POST') {
    const { registration_id, validation_id, is_completed } = req.body;
    if (!registration_id || !validation_id || is_completed === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    try {
      const scopeRows = await sql`
        SELECT c.campus
        FROM registrations r
        JOIN confirmation_submissions c
          ON c.registration_id = r.id
        JOIN sede_validations sv
          ON sv.id = ${validation_id}
        WHERE r.id = ${registration_id}
          AND (
            c.campus = sv.campus 
            OR translate(LOWER(c.campus), 'áéíóú', 'aeiou') = translate(LOWER(sv.campus), 'áéíóú', 'aeiou')
          )
        LIMIT 1
      `;

      if (scopeRows.length === 0) {
        return res.status(400).json({ error: 'Registro o validación inválidos para una misma sede' });
      }

      const targetCampus = String(scopeRows[0].campus ?? '');
      if (!hasCampusAccess(session, targetCampus)) {
        return res.status(403).json({ error: 'Sin permisos para modificar esta sede' });
      }

      await sql`
        INSERT INTO student_sede_validations (registration_id, validation_id, is_completed)
        VALUES (${registration_id}, ${validation_id}, ${is_completed})
        ON CONFLICT (registration_id, validation_id) 
        DO UPDATE SET is_completed = EXCLUDED.is_completed, updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating validation status:', error);
      return res.status(500).json({ error: 'Error interno o tabla no existe' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
