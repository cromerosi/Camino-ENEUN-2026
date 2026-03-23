import { getSql } from './db';

export interface FinalFormAccessDecision {
  isOpen: boolean;
  isAllowedWhenClosed: boolean;
  canAccess: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureFinalFormAccessTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS final_form_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      is_open BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO final_form_settings (id, is_open)
    VALUES (1, FALSE)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS final_form_allowed_users (
      email TEXT PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function getFinalFormAccessForEmail(email: string): Promise<FinalFormAccessDecision> {
  await ensureFinalFormAccessTables();
  const sql = getSql();
  const normalizedEmail = normalizeEmail(email);

  const rows = await sql`
    SELECT
      s.is_open,
      EXISTS (
        SELECT 1
        FROM final_form_allowed_users u
        WHERE lower(trim(u.email)) = ${normalizedEmail}
      ) AS allowed_when_closed
    FROM final_form_settings s
    WHERE s.id = 1
    LIMIT 1
  ` as Array<{ is_open: boolean; allowed_when_closed: boolean }>;

  const row = rows[0];
  const isOpen = Boolean(row?.is_open);
  const isAllowedWhenClosed = Boolean(row?.allowed_when_closed);

  return {
    isOpen,
    isAllowedWhenClosed,
    canAccess: isOpen || isAllowedWhenClosed,
  };
}

export async function getFinalFormGlobalState(): Promise<boolean> {
  await ensureFinalFormAccessTables();
  const sql = getSql();

  const rows = await sql`
    SELECT is_open
    FROM final_form_settings
    WHERE id = 1
    LIMIT 1
  ` as Array<{ is_open: boolean }>;

  return Boolean(rows[0]?.is_open);
}

export async function setFinalFormGlobalState(isOpen: boolean) {
  await ensureFinalFormAccessTables();
  const sql = getSql();

  await sql`
    UPDATE final_form_settings
    SET is_open = ${isOpen},
        updated_at = NOW()
    WHERE id = 1
  `;
}

export async function setFinalFormUserAccess(email: string, allow: boolean) {
  await ensureFinalFormAccessTables();
  const sql = getSql();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return;
  }

  if (allow) {
    await sql`
      INSERT INTO final_form_allowed_users (email, updated_at)
      VALUES (${normalizedEmail}, NOW())
      ON CONFLICT (email)
      DO UPDATE SET updated_at = NOW()
    `;
    return;
  }

  await sql`
    DELETE FROM final_form_allowed_users
    WHERE lower(trim(email)) = ${normalizedEmail}
  `;
}

export async function listFinalFormAllowedUsers(limit = 100) {
  await ensureFinalFormAccessTables();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(limit, 500));

  const rows = await sql`
    SELECT email, updated_at
    FROM final_form_allowed_users
    ORDER BY updated_at DESC
    LIMIT ${safeLimit}
  ` as Array<{ email: string; updated_at: string | Date }>;

  return rows;
}
