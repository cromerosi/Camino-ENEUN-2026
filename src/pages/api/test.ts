import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from "../../lib/db";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const result = await sql`SELECT NOW()`;

  res.status(200).json(result);
}