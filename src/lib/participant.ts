import { getSql } from './db';
import { ENEUN_PROCESS_NODES, type EneunJourneyStepState } from './eneun-schema';

export interface ParticipantViewModel {
  fullName: string;
  documentType: string;
  documentNumber: string;
  site: string;
  faculty: string;
  camping: boolean;
  committee: string;
  uuid: string;
}

interface RegistrationRow {
  id?: number | null;
  email?: string | null;
  first_name: string | null;
  last_name: string | null;
  document_type: string | null;
  document_number: string | null;
  university: string | null;
  faculty: string | null;
  ticket_type: string | null;
  uuid?: string | null;
  registered_at?: string | Date | null;
  confirm_answers?: unknown;
  confirm_submitted_at?: string | Date | null;
  final_submitted_at?: string | Date | null;
  confirmation_campus?: string | null;
}

interface ValidationProgress {
  totalValidations: number;
  completedValidations: number;
}

export interface LocalAuthUser {
  sub: string;
  email: string;
  name: string;
}

function parseCamping(ticketType: string | null): boolean {
  if (!ticketType) {
    return false;
  }
  return /camp|acamp|carpa/i.test(ticketType);
}

function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseCampingFromConfirmAnswers(confirmAnswers: unknown): boolean | null {
  if (!confirmAnswers || typeof confirmAnswers !== 'object' || Array.isArray(confirmAnswers)) {
    return null;
  }

  const record = confirmAnswers as Record<string, unknown>;
  const baseHospedajeSituacion = record.base_hospedaje_situacion;

  if (!baseHospedajeSituacion) {
    return null;
  }

  const value = Array.isArray(baseHospedajeSituacion)
    ? baseHospedajeSituacion[0]
    : baseHospedajeSituacion;

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = normalizeAnswer(value);

  if (normalizedValue === 'planea acampar') {
    return true;
  }

  if (
    normalizedValue === 'ya cuenta con hospedaje y/o reservas' ||
    normalizedValue === 'esta en busqueda de hospedaje y no planea acampar'
  ) {
    return false;
  }

  // Si llega otro texto inesperado, no forzamos valor para permitir fallback por ticket_type.
  return null;
}

function resolveCamping(ticketType: string | null, confirmAnswers: unknown): boolean {
  const fromConfirmAnswers = parseCampingFromConfirmAnswers(confirmAnswers);
  if (fromConfirmAnswers !== null) {
    return fromConfirmAnswers;
  }

  return parseCamping(ticketType);
}

function parseCommitteeFromConfirmAnswers(confirmAnswers: unknown): string {
  if (!confirmAnswers || typeof confirmAnswers !== 'object' || Array.isArray(confirmAnswers)) {
    return 'Sin comité asignado';
  }

  const record = confirmAnswers as Record<string, unknown>;
  const rawCommittee = record.base_equipo_organizacion;

  const values = Array.isArray(rawCommittee)
    ? rawCommittee
    : rawCommittee == null
      ? []
      : [rawCommittee];

  const normalized = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== 'no');

  return normalized.length > 0 ? normalized.join(', ') : 'Sin comité asignado';
}

function toJourneyDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}·${month}`;
}

function parseCountValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function getSedeValidationProgress(
  registrationId: number,
  campus: string,
): Promise<ValidationProgress> {
  try {
    const sql = getSql();

    const totalRows = (await sql`
      SELECT count(*) as total
      FROM sede_validations
      WHERE lower(trim(campus)) = lower(trim(${campus}))
    `) as Array<{ total: unknown }>;

    const completedRows = (await sql`
      SELECT count(*) as completed
      FROM student_sede_validations ssv
      JOIN sede_validations sv
        ON sv.id = ssv.validation_id
      WHERE ssv.registration_id = ${registrationId}
        AND ssv.is_completed = true
        AND lower(trim(sv.campus)) = lower(trim(${campus}))
    `) as Array<{ completed: unknown }>;

    return {
      totalValidations: parseCountValue(totalRows[0]?.total),
      completedValidations: parseCountValue(completedRows[0]?.completed),
    };
  } catch {
    return {
      totalValidations: 0,
      completedValidations: 0,
    };
  }
}

function buildJourneyStepsFromRegistration(
  registration: RegistrationRow | undefined,
  validationProgress: ValidationProgress,
): EneunJourneyStepState[] {
  if (!registration) {
    return ENEUN_PROCESS_NODES.map((label) => ({
      label,
      status: 'gray',
      detail: 'Sin iniciar',
    }));
  }

  const preinscriptionDate = toJourneyDate(registration.registered_at);
  const preconfirmationDate = toJourneyDate(registration.confirm_submitted_at);

  const hasPreconfirmation = Boolean(registration.confirm_submitted_at);
  const { totalValidations, completedValidations } = validationProgress;

  let sedeValidationStatus: EneunJourneyStepState;
  if (!hasPreconfirmation) {
    sedeValidationStatus = {
      label: 'Validacion de sede de origen',
      status: 'gray',
      detail: 'Pendiente de preconfirmación',
    };
  } else if (totalValidations === 0) {
    sedeValidationStatus = {
      label: 'Validacion de sede de origen',
      status: 'purple',
      detail: 'En espera de validaciones de sede',
    };
  } else if (completedValidations >= totalValidations) {
    sedeValidationStatus = {
      label: 'Validacion de sede de origen',
      status: 'green',
      detail: `Completado ${completedValidations}/${totalValidations}`,
    };
  } else if (completedValidations > 0) {
    sedeValidationStatus = {
      label: 'Validacion de sede de origen',
      status: 'purple',
      detail: `En curso ${completedValidations}/${totalValidations}`,
    };
  } else {
    sedeValidationStatus = {
      label: 'Validacion de sede de origen',
      status: 'red',
      detail: `Pendiente 0/${totalValidations}`,
    };
  }

  return [
    {
      label: 'Preinscripcion',
      status: 'green',
      detail: preinscriptionDate ? `Completado el ${preinscriptionDate}` : 'Completado',
    },
    {
      label: 'Preconfirmacion',
      status: hasPreconfirmation ? 'green' : 'red',
      detail: hasPreconfirmation
        ? preconfirmationDate
          ? `Confirmado el ${preconfirmationDate}`
          : 'Confirmado'
        : 'Pendiente de preconfirmación',
    },
    sedeValidationStatus,
    {
      label: 'Capacitaciones de la plataforma',
      status: 'gray',
      detail: 'Todavía no está habilitado',
    },
    {
      label: 'Formulario final',
      status: 'gray',
      detail: 'Todavía no está habilitado',
    },
  ];
}

async function getCommitteeByEmail(email: string): Promise<string> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT confirm_answers
      FROM registrations
      WHERE lower(trim(email)) = lower(trim(${email}))
      ORDER BY coalesce(confirm_submitted_at, registered_at) DESC
      LIMIT 1
    `) as Array<{ confirm_answers: unknown | null }>;

    return parseCommitteeFromConfirmAnswers(rows[0]?.confirm_answers ?? null);
  } catch {
    return 'Sin comité asignado';
  }
}

export async function getParticipantByEmail(email: string): Promise<ParticipantViewModel> {
  const fallback: ParticipantViewModel = {
    fullName: email,
    documentType: 'No disponible',
    documentNumber: 'No disponible',
    site: 'No disponible',
    faculty: 'No disponible',
    camping: false,
    committee: await getCommitteeByEmail(email),
    uuid: 'No disponible',
  };

  try {
    const sql = getSql();
    const registrationRows = (await sql`
      SELECT
        first_name,
        last_name,
        document_type,
        document_number,
        university,
        faculty,
        ticket_type,
        uuid,
        confirm_answers
      FROM registrations
      WHERE lower(email) = lower(${email})
      ORDER BY registered_at DESC
      LIMIT 1
    `) as RegistrationRow[];

    const registration = registrationRows[0];
    if (!registration) {
      return fallback;
    }

    const firstName = registration.first_name?.trim() ?? '';
    const lastName = registration.last_name?.trim() ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;

    return {
      fullName,
      documentType: registration.document_type?.trim() || 'No disponible',
      documentNumber: registration.document_number?.trim() || 'No disponible',
      site: registration.university?.trim() || 'No disponible',
      faculty: registration.faculty?.trim() || 'No disponible',
      camping: resolveCamping(registration.ticket_type, registration.confirm_answers),
      committee: parseCommitteeFromConfirmAnswers(registration.confirm_answers),
      uuid: registration.uuid?.trim() || 'No disponible',
    };
  } catch {
    return fallback;
  }
}

export async function getJourneyStepsByEmail(email: string): Promise<EneunJourneyStepState[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        r.id,
        registered_at,
        confirm_answers,
        confirm_submitted_at,
        final_submitted_at,
        cs.campus as confirmation_campus,
        r.university
      FROM registrations r
      LEFT JOIN confirmation_submissions cs
        ON cs.registration_id = r.id
      WHERE lower(trim(email)) = lower(trim(${email}))
      ORDER BY r.registered_at DESC, cs.submitted_at DESC NULLS LAST
      LIMIT 1
    `) as RegistrationRow[];

    const registration = rows[0];
    if (!registration || !registration.id) {
      return buildJourneyStepsFromRegistration(undefined, {
        totalValidations: 0,
        completedValidations: 0,
      });
    }

    const campus = registration.confirmation_campus?.trim() || registration.university?.trim() || '';
    const validationProgress = campus
      ? await getSedeValidationProgress(registration.id, campus)
      : { totalValidations: 0, completedValidations: 0 };

    return buildJourneyStepsFromRegistration(registration, validationProgress);
  } catch {
    return ENEUN_PROCESS_NODES.map((label) => ({
      label,
      status: 'gray',
      detail: 'Sin iniciar',
    }));
  }
}

function normalizeLocalUsername(username: string): string {
  const cleaned = username.trim().toLowerCase();
  if (!cleaned) {
    return '';
  }
  return cleaned.replace(/@unal\.edu\.co$/i, '');
}

export async function authenticateWithDocument(
  username: string,
  documentNumber: string,
): Promise<LocalAuthUser | null> {
  const localUsername = normalizeLocalUsername(username);
  const normalizedDocument = documentNumber.trim();

  if (!localUsername || !normalizedDocument) {
    return null;
  }

  const email = `${localUsername}@unal.edu.co`;

  try {
    const sql = getSql();
    const registrationRows = (await sql`
      SELECT
        email,
        first_name,
        last_name,
        document_number
      FROM registrations
      WHERE lower(trim(email)) = lower(trim(${email}))
        AND (
          regexp_replace(coalesce(document_number, ''), '[^0-9]', '', 'g') = regexp_replace(${normalizedDocument}, '[^0-9]', '', 'g')
          OR lower(trim(coalesce(document_number, ''))) = lower(trim(${normalizedDocument}))
        )
      ORDER BY registered_at DESC
      LIMIT 1
    `) as RegistrationRow[];

    const registration = registrationRows[0];
    if (!registration?.email) {
      return null;
    }

    const firstName = registration.first_name?.trim() ?? '';
    const lastName = registration.last_name?.trim() ?? '';
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || registration.email;

    return {
      sub: `local:${registration.email.toLowerCase()}`,
      email: registration.email.toLowerCase(),
      name,
    };
  } catch {
    return null;
  }
}
