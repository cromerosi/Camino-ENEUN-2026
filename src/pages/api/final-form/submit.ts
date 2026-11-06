import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionCookieName, verifySignedSessionToken } from '../../../lib/auth';
import { getSql, withTransaction } from '../../../lib/db';
import { getFinalFormAccessForEmail } from '../../../lib/final-form-access';
import { isPlainObject, setNoStore } from '../../../lib/http';
import {
  EXCLUSIVE_HEALTH_CODES,
  confirmationHealthDetailQuestions,
  confirmationHealthOptions,
  confirmationTransportOptions,
} from '../../../modules/constants/confirmationCatalogs';
import type {
  ConfirmationCampingConfirmation,
  ConfirmationFormData,
  ConfirmationHealthConditionCode,
  ConfirmationTransport,
} from '../../../modules/types/confirmation';
import { PHONE_PATTERN } from '../../../modules/utils/confirmationFormUtils';

const HEALTH_DETAIL_MAX_LENGTH = 500;

const ALLOWED_HEALTH_CODES = new Set<ConfirmationHealthConditionCode>(
  confirmationHealthOptions.map((option) => option.code),
);

const ALLOWED_TRANSPORT = new Set<ConfirmationTransport>(['', 'SI', 'PROPIOS_MEDIOS']);

const TRANSPORT_LABELS: Record<Exclude<ConfirmationTransport, ''>, string> = Object.fromEntries(
  confirmationTransportOptions.map((option) => [option.value, option.label]),
) as Record<Exclude<ConfirmationTransport, ''>, string>;

interface RegistrationRow {
  id: number | null;
  uuid: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_confirmation_submission: boolean;
}

function toYesNo(value: boolean): 'Si' | 'No' {
  return value ? 'Si' : 'No';
}

function normalizeText(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function normalizeHealthCodes(value: unknown): ConfirmationHealthConditionCode[] {
  if (!Array.isArray(value)) {
    return ['NONE'];
  }

  const filtered = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toUpperCase())
        .filter((item): item is ConfirmationHealthConditionCode =>
          ALLOWED_HEALTH_CODES.has(item as ConfirmationHealthConditionCode),
        ),
    ),
  );

  if (filtered.length === 0) {
    return ['NONE'];
  }

  // Las opciones excluyentes ("Ninguna" / "Prefiero no responder") anulan el resto.
  for (const exclusiveCode of EXCLUSIVE_HEALTH_CODES) {
    if (filtered.includes(exclusiveCode)) {
      return [exclusiveCode];
    }
  }

  return filtered;
}

function parseCampingConfirmation(value: unknown): ConfirmationCampingConfirmation {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'YES' || normalized === 'NO' ? normalized : '';
}

function parseTransportSelection(value: unknown): ConfirmationTransport {
  const normalized = (typeof value === 'string' ? value.trim().toUpperCase() : '') as ConfirmationTransport;
  return ALLOWED_TRANSPORT.has(normalized) ? normalized : '';
}

function parsePayload(body: unknown): ConfirmationFormData | null {
  if (!isPlainObject(body)) {
    return null;
  }

  const healthDetails = Object.fromEntries(
    confirmationHealthDetailQuestions.map((question) => [
      question.field,
      normalizeText(body[question.field], HEALTH_DETAIL_MAX_LENGTH),
    ]),
  ) as Pick<ConfirmationFormData, (typeof confirmationHealthDetailQuestions)[number]['field']>;

  const payload: ConfirmationFormData = {
    ...healthDetails,
    id: normalizeText(body.id, 64),
    badgeName: normalizeText(body.badgeName, 120),
    sede: normalizeText(body.sede, 120),
    pronoun: normalizeText(body.pronoun, 40),
    pronounOther: normalizeText(body.pronounOther, 60),
    healthConditionCodes: normalizeHealthCodes(body.healthConditionCodes),
    bloodTypeId: normalizeText(body.bloodTypeId, 20),
    emergencyContactName: normalizeText(body.emergencyContactName, 120),
    emergencyContactRelationship: normalizeText(body.emergencyContactRelationship, 120),
    emergencyContactPhone: normalizeText(body.emergencyContactPhone, 40),
    lodgingChoice: normalizeText(body.lodgingChoice, 120),
    lodgingAddress: normalizeText(body.lodgingAddress, 240),
    transport: parseTransportSelection(body.transport),
    campingConfirmation: parseCampingConfirmation(body.campingConfirmation),
    epsId: normalizeText(body.epsId, 120),
    consentHealthData: body.consentHealthData === true,
  };

  const isValid =
    Boolean(payload.id && payload.badgeName && payload.pronoun) &&
    !(payload.pronoun === 'otro' && !payload.pronounOther) &&
    Boolean(payload.emergencyContactName && payload.emergencyContactRelationship) &&
    PHONE_PATTERN.test(payload.emergencyContactPhone) &&
    Boolean(payload.lodgingChoice && payload.transport) &&
    Boolean(payload.epsId && payload.consentHealthData) &&
    confirmationHealthDetailQuestions.every(
      (question) => !payload.healthConditionCodes.includes(question.code) || Boolean(payload[question.field]),
    );

  return isValid ? payload : null;
}

async function createAttendeesTable(): Promise<void> {
  const sql = getSql();

  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attendees (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identification_number TEXT NOT NULL,
      attendee_id TEXT NOT NULL,
      email TEXT,
      badge_name TEXT NOT NULL,
      legal_name TEXT,
      sede TEXT NOT NULL,
      pronoun TEXT NOT NULL,
      blood_type_id TEXT,
      eps_id TEXT NOT NULL,
      consent_health_data BOOLEAN NOT NULL,
      health_condition_codes TEXT[] NOT NULL DEFAULT '{}',
      health_details JSONB NOT NULL DEFAULT '{}',
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_relationship TEXT NOT NULL,
      emergency_contact_phone TEXT NOT NULL,
      lodging_choice TEXT NOT NULL,
      lodging_address TEXT,
      transport TEXT,
      camping_confirmation TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS attendees_attendee_id_key
    ON attendees (attendee_id)
  `;

  await sql`
    ALTER TABLE attendees
    ADD COLUMN IF NOT EXISTS transport TEXT
  `;
}

let ensureAttendeesTablePromise: Promise<void> | null = null;

/** Prepara la tabla attendees una sola vez por proceso (reintenta si falla). */
function ensureAttendeesTable(): Promise<void> {
  if (!ensureAttendeesTablePromise) {
    ensureAttendeesTablePromise = createAttendeesTable().catch((error: unknown) => {
      ensureAttendeesTablePromise = null;
      throw error;
    });
  }
  return ensureAttendeesTablePromise;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setNoStore(res);

  const authUser = await verifySignedSessionToken(req.cookies[getSessionCookieName()]);
  if (!authUser?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const access = await getFinalFormAccessForEmail(authUser.email);
    if (!access.canAccess) {
      return res.status(403).json({ error: 'El formulario final está cerrado en este momento.' });
    }

    const payload = parsePayload(req.body);
    if (!payload) {
      return res.status(400).json({ error: 'Datos del formulario inválidos' });
    }

    const sql = getSql();
    const registrations = (await sql`
      SELECT
        r.id,
        r.uuid,
        r.email,
        r.first_name,
        r.last_name,
        (
          r.confirm_submitted_at IS NOT NULL OR EXISTS (
            SELECT 1
            FROM confirmation_submissions cs
            WHERE cs.registration_id = r.id
          )
        ) AS has_confirmation_submission
      FROM registrations r
      WHERE lower(trim(r.email)) = lower(trim(${authUser.email}))
      ORDER BY r.registered_at DESC
      LIMIT 1
    `) as RegistrationRow[];

    const registration = registrations[0];
    const registrationId = registration?.id;
    if (!registration || !registrationId) {
      return res.status(404).json({ error: 'No encontramos un registro para este correo' });
    }

    // Los correos habilitados manualmente (excepciones) no requieren preconfirmación.
    if (!registration.has_confirmation_submission && !access.isAllowedWhenClosed) {
      return res.status(403).json({
        error: 'Debes realizar la preconfirmación antes de enviar el formulario final.',
      });
    }

    const attendeeUuid = registration.uuid?.trim() || '';
    if (!attendeeUuid) {
      return res.status(400).json({ error: 'El registro no tiene UUID válido en registrations' });
    }

    await ensureAttendeesTable();

    const firstName = registration.first_name?.trim() || '';
    const lastName = registration.last_name?.trim() || '';
    const legalName = `${firstName} ${lastName}`.trim();
    const attendeeId = String(registrationId);
    const attendeeEmail = registration.email?.trim() || authUser.email;

    const conditionDetails = Object.fromEntries(
      confirmationHealthDetailQuestions
        .map((question) => [question.storageKey, payload[question.field]] as const)
        .filter(([, value]) => Boolean(value)),
    );

    const healthDetails = {
      health_condition_codes: payload.healthConditionCodes,
      has_reported_conditions: payload.healthConditionCodes.some(
        (code) => !EXCLUSIVE_HEALTH_CODES.includes(code),
      ),
      condition_details: conditionDetails,
      blood_type_id: payload.bloodTypeId || null,
      eps_id: payload.epsId,
      consent_health_data: toYesNo(payload.consentHealthData),
    };

    const resolvedPronoun = payload.pronoun === 'otro' ? payload.pronounOther : payload.pronoun;
    const transportLabel = payload.transport === 'SI' ? TRANSPORT_LABELS.SI : TRANSPORT_LABELS.PROPIOS_MEDIOS;

    const formattedPayload = {
      email: attendeeEmail,
      campus: payload.sede,
      sede: payload.sede,
      attendee_id: attendeeId,
      uuid: attendeeUuid,
      identification_number: payload.id,
      badge_name: payload.badgeName,
      full_name: legalName || payload.badgeName,
      last_name: lastName,
      first_name: firstName,
      pronoun: resolvedPronoun,
      pronoun_selection: payload.pronoun,
      pronoun_other: payload.pronounOther || null,
      blood_type_id: payload.bloodTypeId || null,
      eps_id: payload.epsId,
      consent_health_data: toYesNo(payload.consentHealthData),
      health_condition_codes: payload.healthConditionCodes,
      health_details: healthDetails,
      emergency_contact_name: payload.emergencyContactName,
      emergency_contact_relationship: payload.emergencyContactRelationship,
      emergency_contact_phone: payload.emergencyContactPhone,
      lodging_choice: payload.lodgingChoice,
      lodging_address: payload.lodgingAddress || null,
      camping_confirmation: payload.campingConfirmation || null,
      transport: transportLabel,
    };

    // El registro en attendees y la marca en registrations se guardan juntos.
    const submittedAt = await withTransaction(async (tx) => {
      await tx`
        INSERT INTO attendees (
          uuid,
          identification_number,
          attendee_id,
          email,
          badge_name,
          legal_name,
          sede,
          pronoun,
          blood_type_id,
          eps_id,
          consent_health_data,
          health_condition_codes,
          health_details,
          emergency_contact_name,
          emergency_contact_relationship,
          emergency_contact_phone,
          lodging_choice,
          lodging_address,
          transport,
          camping_confirmation,
          payload,
          updated_at
        )
        VALUES (
          ${attendeeUuid},
          ${payload.id},
          ${attendeeId},
          ${attendeeEmail},
          ${payload.badgeName},
          ${legalName || null},
          ${payload.sede},
          ${resolvedPronoun},
          ${payload.bloodTypeId || null},
          ${payload.epsId},
          ${payload.consentHealthData},
          ${payload.healthConditionCodes},
          ${tx.json(healthDetails)},
          ${payload.emergencyContactName},
          ${payload.emergencyContactRelationship},
          ${payload.emergencyContactPhone},
          ${payload.lodgingChoice},
          ${payload.lodgingAddress || null},
          ${payload.transport || null},
          ${payload.campingConfirmation || null},
          ${tx.json(formattedPayload)},
          NOW()
        )
        ON CONFLICT (attendee_id)
        DO UPDATE SET
          uuid = EXCLUDED.uuid,
          identification_number = EXCLUDED.identification_number,
          email = EXCLUDED.email,
          badge_name = EXCLUDED.badge_name,
          legal_name = EXCLUDED.legal_name,
          sede = EXCLUDED.sede,
          pronoun = EXCLUDED.pronoun,
          blood_type_id = EXCLUDED.blood_type_id,
          eps_id = EXCLUDED.eps_id,
          consent_health_data = EXCLUDED.consent_health_data,
          health_condition_codes = EXCLUDED.health_condition_codes,
          health_details = EXCLUDED.health_details,
          emergency_contact_name = EXCLUDED.emergency_contact_name,
          emergency_contact_relationship = EXCLUDED.emergency_contact_relationship,
          emergency_contact_phone = EXCLUDED.emergency_contact_phone,
          lodging_choice = EXCLUDED.lodging_choice,
          lodging_address = EXCLUDED.lodging_address,
          transport = EXCLUDED.transport,
          camping_confirmation = EXCLUDED.camping_confirmation,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `;

      const updated = (await tx`
        UPDATE registrations
        SET final_submitted_at = NOW()
        WHERE id = ${registrationId}
        RETURNING final_submitted_at
      `) as Array<{ final_submitted_at: string | Date | null }>;

      return updated[0]?.final_submitted_at ?? null;
    });

    return res.status(200).json({
      success: true,
      message: 'Información enviada correctamente.',
      submittedAt,
    });
  } catch (error) {
    console.error('Error guardando formulario final:', error);
    return res.status(500).json({ error: 'No pudimos guardar el formulario en attendees' });
  }
}
