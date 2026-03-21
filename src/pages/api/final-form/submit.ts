import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionCookieName, verifySignedSessionToken } from '../../../lib/auth';
import { getSql } from '../../../lib/db';

type CampingConfirmation = '' | 'YES' | 'NO';
type TransportSelection = '' | 'SI' | 'PROPIOS_MEDIOS';

type ConfirmationHealthConditionCode =
  | 'NONE'
  | 'PREFER_NOT_TO_ANSWER'
  | 'ALLERGIES'
  | 'ASTHMA'
  | 'DIABETES'
  | 'NON_NEUROTYPICAL'
  | 'EPILEPSY'
  | 'HYPERTENSION'
  | 'CARDIAC'
  | 'REDUCED_MOBILITY'
  | 'VISUAL_DISABILITY'
  | 'HEARING_DISABILITY'
  | 'PERMANENT_MEDICATION'
  | 'PSYCHOSOCIAL_DISABILITY'
  | 'OTHER';

interface ConfirmationFormPayload {
  id: string;
  badgeName: string;
  sede: string;
  pronoun: string;
  pronounOther: string;
  healthConditionCodes: ConfirmationHealthConditionCode[];
  allergiesDetail: string;
  asthmaDetail: string;
  diabetesDetail: string;
  nonNeurotypicalDetail: string;
  epilepsyDetail: string;
  hypertensionDetail: string;
  cardiacConditionsDetail: string;
  reducedMobilityDetail: string;
  visualDisabilityDetail: string;
  hearingDisabilityDetail: string;
  permanentMedicationDetail: string;
  psychosocialDisabilityDetail: string;
  otherHealthConditionDetail: string;
  bloodTypeId: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  lodgingChoice: string;
  lodgingAddress: string;
  transport: TransportSelection;
  campingConfirmation: CampingConfirmation;
  epsId: string;
  consentHealthData: boolean;
}

const ALLOWED_HEALTH_CODES = new Set<ConfirmationHealthConditionCode>([
  'NONE',
  'PREFER_NOT_TO_ANSWER',
  'ALLERGIES',
  'ASTHMA',
  'DIABETES',
  'NON_NEUROTYPICAL',
  'EPILEPSY',
  'HYPERTENSION',
  'CARDIAC',
  'REDUCED_MOBILITY',
  'VISUAL_DISABILITY',
  'HEARING_DISABILITY',
  'PERMANENT_MEDICATION',
  'PSYCHOSOCIAL_DISABILITY',
  'OTHER',
]);

const ALLOWED_TRANSPORT = new Set<TransportSelection>(['', 'SI', 'PROPIOS_MEDIOS']);

function toYesNo(value: boolean): 'Si' | 'No' {
  return value ? 'Si' : 'No';
}

function normalizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLen);
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
          ALLOWED_HEALTH_CODES.has(item as ConfirmationHealthConditionCode)
        )
    )
  );

  if (filtered.length === 0) {
    return ['NONE'];
  }

  if (filtered.includes('NONE')) {
    return ['NONE'];
  }

  if (filtered.includes('PREFER_NOT_TO_ANSWER')) {
    return ['PREFER_NOT_TO_ANSWER'];
  }

  return filtered;
}

function parseCampingConfirmation(value: unknown): CampingConfirmation {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'YES' || normalized === 'NO') {
    return normalized;
  }

  return '';
}

function parseTransportSelection(value: unknown): TransportSelection {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase() as TransportSelection;
  return ALLOWED_TRANSPORT.has(normalized) ? normalized : '';
}

function parsePayload(body: unknown): ConfirmationFormPayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const healthConditionCodes = normalizeHealthCodes(record.healthConditionCodes);

  const payload: ConfirmationFormPayload = {
    id: normalizeText(record.id, 64),
    badgeName: normalizeText(record.badgeName, 120),
    sede: normalizeText(record.sede, 120),
    pronoun: normalizeText(record.pronoun, 40),
    pronounOther: normalizeText(record.pronounOther, 60),
    healthConditionCodes,
    allergiesDetail: normalizeText(record.allergiesDetail, 500),
    asthmaDetail: normalizeText(record.asthmaDetail, 500),
    diabetesDetail: normalizeText(record.diabetesDetail, 500),
    nonNeurotypicalDetail: normalizeText(record.nonNeurotypicalDetail, 500),
    epilepsyDetail: normalizeText(record.epilepsyDetail, 500),
    hypertensionDetail: normalizeText(record.hypertensionDetail, 500),
    cardiacConditionsDetail: normalizeText(record.cardiacConditionsDetail, 500),
    reducedMobilityDetail: normalizeText(record.reducedMobilityDetail, 500),
    visualDisabilityDetail: normalizeText(record.visualDisabilityDetail, 500),
    hearingDisabilityDetail: normalizeText(record.hearingDisabilityDetail, 500),
    permanentMedicationDetail: normalizeText(record.permanentMedicationDetail, 500),
    psychosocialDisabilityDetail: normalizeText(record.psychosocialDisabilityDetail, 500),
    otherHealthConditionDetail: normalizeText(record.otherHealthConditionDetail, 500),
    bloodTypeId: normalizeText(record.bloodTypeId, 20),
    emergencyContactName: normalizeText(record.emergencyContactName, 120),
    emergencyContactRelationship: normalizeText(record.emergencyContactRelationship, 120),
    emergencyContactPhone: normalizeText(record.emergencyContactPhone, 40),
    lodgingChoice: normalizeText(record.lodgingChoice, 120),
    lodgingAddress: normalizeText(record.lodgingAddress, 240),
    transport: parseTransportSelection(record.transport),
    campingConfirmation: parseCampingConfirmation(record.campingConfirmation),
    epsId: normalizeText(record.epsId, 120),
    consentHealthData: record.consentHealthData === true,
  };

  if (!payload.id || !payload.badgeName || !payload.pronoun) {
    return null;
  }

  if (payload.pronoun === 'otro' && !payload.pronounOther) {
    return null;
  }

  if (!payload.emergencyContactName || !payload.emergencyContactRelationship) {
    return null;
  }

  if (!payload.emergencyContactPhone || !/^[0-9+ ]{7,20}$/.test(payload.emergencyContactPhone)) {
    return null;
  }

  if (!payload.lodgingChoice) {
    return null;
  }

  if (!payload.transport) {
    return null;
  }

  if (!payload.epsId || !payload.consentHealthData) {
    return null;
  }

  if (payload.healthConditionCodes.includes('ALLERGIES') && !payload.allergiesDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('ASTHMA') && !payload.asthmaDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('DIABETES') && !payload.diabetesDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('NON_NEUROTYPICAL') && !payload.nonNeurotypicalDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('EPILEPSY') && !payload.epilepsyDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('HYPERTENSION') && !payload.hypertensionDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('CARDIAC') && !payload.cardiacConditionsDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('REDUCED_MOBILITY') && !payload.reducedMobilityDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('VISUAL_DISABILITY') && !payload.visualDisabilityDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('HEARING_DISABILITY') && !payload.hearingDisabilityDetail) {
    return null;
  }

  if (payload.healthConditionCodes.includes('PERMANENT_MEDICATION') && !payload.permanentMedicationDetail) {
    return null;
  }

  if (
    payload.healthConditionCodes.includes('PSYCHOSOCIAL_DISABILITY') &&
    !payload.psychosocialDisabilityDetail
  ) {
    return null;
  }

  if (payload.healthConditionCodes.includes('OTHER') && !payload.otherHealthConditionDetail) {
    return null;
  }

  return payload;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.cookies[getSessionCookieName()];
  const authUser = await verifySignedSessionToken(token);

  if (!authUser?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const payload = parsePayload(req.body);
  if (!payload) {
    return res.status(400).json({ error: 'Datos del formulario inválidos' });
  }

  const sql = getSql();

  try {
    const registrations = await sql`
      SELECT id, uuid, email, first_name, last_name
      FROM registrations
      WHERE lower(trim(email)) = lower(trim(${authUser.email}))
      ORDER BY registered_at DESC
      LIMIT 1
    ` as Array<{
      id: number | null;
      uuid: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>;

    const registration = registrations[0];
    const registrationId = registration?.id;
    if (!registrationId) {
      return res.status(404).json({ error: 'No encontramos un registro para este correo' });
    }

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

    const legalName = `${registration.first_name?.trim() || ''} ${registration.last_name?.trim() || ''}`.trim();
    const attendeeUuid = registration.uuid?.trim() || '';
    if (!attendeeUuid) {
      return res.status(400).json({ error: 'El registro no tiene UUID válido en registrations' });
    }

    const attendeeId = String(registrationId);
    const attendeeEmail = registration.email?.trim() || authUser.email;
    const rawHealthDetails: Record<string, string> = {
      allergies: payload.allergiesDetail,
      asthma: payload.asthmaDetail,
      diabetes: payload.diabetesDetail,
      non_neurotypical: payload.nonNeurotypicalDetail,
      epilepsy: payload.epilepsyDetail,
      hypertension: payload.hypertensionDetail,
      cardiac_conditions: payload.cardiacConditionsDetail,
      reduced_mobility: payload.reducedMobilityDetail,
      visual_disability: payload.visualDisabilityDetail,
      hearing_disability: payload.hearingDisabilityDetail,
      permanent_medication: payload.permanentMedicationDetail,
      psychosocial_disability: payload.psychosocialDisabilityDetail,
      other: payload.otherHealthConditionDetail,
    };

    const conditionDetails = Object.fromEntries(
      Object.entries(rawHealthDetails).filter(([, value]) => Boolean(value))
    );

    const healthDetails = {
      health_condition_codes: payload.healthConditionCodes,
      has_reported_conditions: payload.healthConditionCodes.some(
        (code) => code !== 'NONE' && code !== 'PREFER_NOT_TO_ANSWER'
      ),
      condition_details: conditionDetails,
      blood_type_id: payload.bloodTypeId || null,
      eps_id: payload.epsId,
      consent_health_data: toYesNo(payload.consentHealthData),
    };

    const resolvedPronoun = payload.pronoun === 'otro' ? payload.pronounOther : payload.pronoun;

    const transportLabel =
      payload.transport === 'SI'
        ? 'Sí, me comprometo a hacer uso responsable del transporte, recursos y/o medios suministrados por la universidad'
        : 'No, me comprometo a movilizarme por medio de mis propios recursos';

    const formattedPayload = {
      email: attendeeEmail,
      campus: payload.sede,
      sede: payload.sede,
      attendee_id: attendeeId,
      uuid: registration.uuid?.trim() || null,
      identification_number: payload.id,
      badge_name: payload.badgeName,
      full_name: legalName || payload.badgeName,
      last_name: registration.last_name?.trim() || '',
      first_name: registration.first_name?.trim() || '',
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

    await sql`
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
        ${sql.json(healthDetails)},
        ${payload.emergencyContactName},
        ${payload.emergencyContactRelationship},
        ${payload.emergencyContactPhone},
        ${payload.lodgingChoice},
        ${payload.lodgingAddress || null},
        ${payload.transport || null},
        ${payload.campingConfirmation || null},
        ${sql.json(formattedPayload)},
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

    const updatedRegistration = await sql`
      UPDATE registrations
      SET final_submitted_at = NOW()
      WHERE id = ${registrationId}
      RETURNING final_submitted_at
    ` as Array<{ final_submitted_at: string | Date | null }>;

    return res.status(200).json({
      success: true,
      message: 'Información enviada correctamente.',
      submittedAt: updatedRegistration[0]?.final_submitted_at ?? null,
    });
  } catch (error) {
    console.error('Error guardando formulario final:', error);
    return res.status(500).json({ error: 'No pudimos guardar el formulario en attendees' });
  }
}
