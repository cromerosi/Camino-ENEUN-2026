import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { verifyAdminSessionToken, getAdminSessionCookieName } from '../../../lib/admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);
  
  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const sql = getSql();

  if (req.method === 'GET') {
    try {
      const validations = await sql`
        SELECT id, name, created_at
        FROM sede_validations
        WHERE campus = ${session.campus}
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ validations });
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

    try {
      const countRes = await sql`
        SELECT count(*) as count
        FROM sede_validations
        WHERE campus = ${session.campus}
      `;
      const currentCount = parseInt(countRes[0].count, 10);
      if (currentCount >= 7) {
        return res.status(400).json({ error: 'Límite de 7 validaciones alcanzado' });
      }

      const inserted = await sql`
        INSERT INTO sede_validations (campus, name)
        VALUES (${session.campus}, ${name.trim()})
        RETURNING id, name, created_at
      `;
      
      return res.status(201).json({ validation: inserted[0] });
    } catch (error) {
      console.error('Error inserting sede_validation:', error);
      return res.status(500).json({ error: 'Error interno o la tabla no existe en la base de datos.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
