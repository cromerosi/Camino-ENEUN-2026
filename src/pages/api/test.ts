import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from "../../lib/db";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const sql = getSql();
  const result = await sql`SELECT NOW()`;

  res.status(200).json(result);
}