import { getSql, getTrainingSql } from './db';
import { ENEUN_PROCESS_NODES, type EneunJourneyStepState } from './eneun-schema';
import { getDatePartsInAppTimeZone } from './timezone';

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

interface ParticipantRow {
  first_name: string | null;
  last_name: string | null;
  document_type: string | null;
  document_number: string | null;
  university: string | null;
  faculty: string | null;
  ticket_type: string | null;
  uuid: string | null;
  confirm_answers: unknown;
  attendee_identification_number: string | null;
  attendee_lodging_choice: string | null;
  attendee_camping_confirmation: string | null;
}

interface JourneyRegistrationRow {
  id: number | null;
  registered_at: string | Date | null;
  confirm_submitted_at: string | Date | null;
  confirmation_campus: string | null;
  university: string | null;
}

interface ValidationProgress {
  totalValidations: number;
  completedValidations: number;
}

interface TrainingStatus {
  completada: boolean;
  updated_at: string | Date | null;
}

const NOT_AVAILABLE = 'No disponible';
const NO_COMMITTEE = 'Sin comité asignado';
const EMPTY_PROGRESS: ValidationProgress = { totalValidations: 0, completedValidations: 0 };

function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function parseCampingFromTicketType(ticketType: string | null): boolean {
  return ticketType ? /camp|acamp|carpa/i.test(ticketType) : false;
}

function parseCampingFromConfirmAnswers(confirmAnswers: unknown): boolean | null {
  if (!confirmAnswers || typeof confirmAnswers !== 'object' || Array.isArray(confirmAnswers)) {
    return null;
  }

  const rawValue = (confirmAnswers as Record<string, unknown>).base_hospedaje_situacion;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
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

  // Texto inesperado: no se fuerza un valor para permitir el respaldo por ticket_type.
  return null;
}

function parseCampingFromAttendee(row: ParticipantRow): boolean | null {
  const campingConfirmation = row.attendee_camping_confirmation?.trim().toUpperCase();
  if (campingConfirmation === 'YES') {
    return true;
  }

  if (campingConfirmation === 'NO') {
    return false;
  }

  const lodgingChoice = normalizeAnswer(row.attendee_lodging_choice ?? '');
  if (lodgingChoice === 'planea acampar') {
    return true;
  }

  return lodgingChoice ? false : null;
}

function resolveCamping(row: ParticipantRow): boolean {
  return (
    parseCampingFromAttendee(row) ??
    parseCampingFromConfirmAnswers(row.confirm_answers) ??
    parseCampingFromTicketType(row.ticket_type)
  );
}

function parseCommitteeFromConfirmAnswers(confirmAnswers: unknown): string {
  if (!confirmAnswers || typeof confirmAnswers !== 'object' || Array.isArray(confirmAnswers)) {
    return NO_COMMITTEE;
  }

  const rawCommittee = (confirmAnswers as Record<string, unknown>).base_equipo_organizacion;
  const values = Array.isArray(rawCommittee) ? rawCommittee : rawCommittee == null ? [] : [rawCommittee];

  const normalized = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== 'no');

  return normalized.length > 0 ? normalized.join(', ') : NO_COMMITTEE;
}

function toJourneyDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const dateParts = getDatePartsInAppTimeZone(value);
  return dateParts ? `${dateParts.day}·${dateParts.month}` : null;
}

function buildEmptyJourneySteps(): EneunJourneyStepState[] {
  return ENEUN_PROCESS_NODES.map((label) => ({
    label,
    status: 'gray',
    detail: 'Sin iniciar',
  }));
}

async function getSedeValidationProgress(registrationId: number, campus: string): Promise<ValidationProgress> {
  try {
    const sql = getSql();
    // La sede se compara sin tildes ni mayúsculas, igual que en el panel admin.
    const rows = (await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM student_sede_validations ssv
            WHERE ssv.validation_id = sv.id
              AND ssv.registration_id = ${registrationId}
              AND ssv.is_completed = true
          )
        )::int AS completed
      FROM sede_validations sv
      WHERE translate(lower(trim(sv.campus)), 'áéíóúü', 'aeiouu')
        = translate(lower(trim(${campus})), 'áéíóúü', 'aeiouu')
    `) as Array<{ total: number; completed: number }>;

    return {
      totalValidations: Number(rows[0]?.total ?? 0),
      completedValidations: Number(rows[0]?.completed ?? 0),
    };
  } catch (error) {
    console.error('Error fetching sede validation progress:', error);
    return EMPTY_PROGRESS;
  }
}

async function getTrainingStatusById(registrationId: number): Promise<TrainingStatus | null> {
  try {
    const sql = getTrainingSql();
    const rows = (await sql`
      SELECT completada, updated_at
      FROM student_capacitaciones
      WHERE student_registration_id = ${registrationId}
      LIMIT 1
    `) as Array<{ completada: boolean; updated_at: string | Date | null }>;

    const row = rows[0];
    return row ? { completada: Boolean(row.completada), updated_at: row.updated_at } : null;
  } catch (error) {
    console.error('Error fetching training status:', error);
    return null;
  }
}

async function getFinalFormSubmittedAt(registrationId: number): Promise<string | Date | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT updated_at
    FROM attendees
    WHERE attendee_id = ${String(registrationId)}
    ORDER BY updated_at DESC
    LIMIT 1
  `) as Array<{ updated_at: string | Date | null }>;

  return rows[0]?.updated_at ?? null;
}

function buildSedeValidationStep(
  hasPreconfirmation: boolean,
  { totalValidations, completedValidations }: ValidationProgress,
): EneunJourneyStepState {
  const label = 'Validacion de sede de origen';

  if (!hasPreconfirmation) {
    return { label, status: 'gray', detail: 'Pendiente de preconfirmación' };
  }

  if (totalValidations === 0) {
    return { label, status: 'purple', detail: 'En espera de validaciones de sede' };
  }

  if (completedValidations >= totalValidations) {
    return { label, status: 'green', detail: `Completado ${completedValidations}/${totalValidations}` };
  }

  if (completedValidations > 0) {
    return { label, status: 'purple', detail: `En curso ${completedValidations}/${totalValidations}` };
  }

  return { label, status: 'red', detail: `Pendiente 0/${totalValidations}` };
}

function buildJourneySteps(
  registration: JourneyRegistrationRow,
  validationProgress: ValidationProgress,
  trainingStatus: TrainingStatus | null,
  finalFormSubmittedAt: string | Date | null,
): EneunJourneyStepState[] {
  const preinscriptionDate = toJourneyDate(registration.registered_at);
  const preconfirmationDate = toJourneyDate(registration.confirm_submitted_at);
  const finalSubmissionDate = toJourneyDate(finalFormSubmittedAt);
  const trainingDate = toJourneyDate(trainingStatus?.updated_at);
  const hasPreconfirmation = Boolean(registration.confirm_submitted_at);
  const trainingCompleted = Boolean(trainingStatus?.completada);

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
    buildSedeValidationStep(hasPreconfirmation, validationProgress),
    {
      label: 'Capacitaciones de la plataforma',
      status: trainingCompleted ? 'green' : 'purple',
      detail: trainingCompleted
        ? trainingDate
          ? `Completado el ${trainingDate}`
          : 'Completado'
        : 'Ya está en curso. Haz clic aquí para ingresar.',
    },
    {
      label: 'Formulario final',
      status: finalFormSubmittedAt ? 'green' : 'purple',
      detail: finalFormSubmittedAt
        ? finalSubmissionDate
          ? `Completado el ${finalSubmissionDate}`
          : 'Completado'
        : 'Formulario en curso',
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
    `) as Array<{ confirm_answers: unknown }>;

    return parseCommitteeFromConfirmAnswers(rows[0]?.confirm_answers ?? null);
  } catch {
    return NO_COMMITTEE;
  }
}

export async function getParticipantByEmail(email: string): Promise<ParticipantViewModel> {
  const buildFallback = async (): Promise<ParticipantViewModel> => ({
    fullName: email,
    documentType: NOT_AVAILABLE,
    documentNumber: NOT_AVAILABLE,
    site: NOT_AVAILABLE,
    faculty: NOT_AVAILABLE,
    camping: false,
    committee: await getCommitteeByEmail(email),
    uuid: NOT_AVAILABLE,
  });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        r.first_name,
        r.last_name,
        r.document_type,
        r.document_number,
        r.university,
        r.faculty,
        r.ticket_type,
        r.uuid,
        r.confirm_answers,
        a.identification_number AS attendee_identification_number,
        a.lodging_choice AS attendee_lodging_choice,
        a.camping_confirmation AS attendee_camping_confirmation
      FROM registrations r
      LEFT JOIN attendees a
        ON a.attendee_id = r.id::text
      WHERE lower(trim(r.email)) = lower(trim(${email}))
      ORDER BY COALESCE(a.updated_at, r.registered_at) DESC NULLS LAST, r.registered_at DESC
      LIMIT 1
    `) as ParticipantRow[];

    const registration = rows[0];
    if (!registration) {
      return await buildFallback();
    }

    const fullName =
      [registration.first_name?.trim(), registration.last_name?.trim()].filter(Boolean).join(' ') || email;

    return {
      fullName,
      documentType: registration.document_type?.trim() || NOT_AVAILABLE,
      documentNumber:
        registration.attendee_identification_number?.trim() ||
        registration.document_number?.trim() ||
        NOT_AVAILABLE,
      site: registration.university?.trim() || NOT_AVAILABLE,
      faculty: registration.faculty?.trim() || NOT_AVAILABLE,
      camping: resolveCamping(registration),
      committee: parseCommitteeFromConfirmAnswers(registration.confirm_answers),
      uuid: registration.uuid?.trim() || NOT_AVAILABLE,
    };
  } catch (error) {
    console.error('Error fetching participant:', error);
    return buildFallback();
  }
}

export async function getJourneyStepsByEmail(email: string): Promise<EneunJourneyStepState[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        r.id,
        r.registered_at,
        r.confirm_submitted_at,
        r.university,
        cs.campus AS confirmation_campus
      FROM registrations r
      LEFT JOIN confirmation_submissions cs
        ON cs.registration_id = r.id
      WHERE lower(trim(r.email)) = lower(trim(${email}))
      ORDER BY r.registered_at DESC, cs.submitted_at DESC NULLS LAST
      LIMIT 1
    `) as JourneyRegistrationRow[];

    const registration = rows[0];
    if (!registration?.id) {
      return buildEmptyJourneySteps();
    }

    const registrationId = registration.id;
    const campus = registration.confirmation_campus?.trim() || registration.university?.trim() || '';

    const [validationProgress, trainingStatus, finalFormSubmittedAt] = await Promise.all([
      campus ? getSedeValidationProgress(registrationId, campus) : Promise.resolve(EMPTY_PROGRESS),
      getTrainingStatusById(registrationId),
      getFinalFormSubmittedAt(registrationId),
    ]);

    return buildJourneySteps(registration, validationProgress, trainingStatus, finalFormSubmittedAt);
  } catch (error) {
    console.error('Error building journey steps:', error);
    return buildEmptyJourneySteps();
  }
}

/**
 * Sedes asociadas a un participante (las de sus preconfirmaciones o, si no
 * tiene, la de su registro). Se usa para validar la vista previa de admins.
 */
export async function getParticipantCampusesByEmail(email: string): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT cs.campus AS confirmation_campus, r.university
    FROM registrations r
    LEFT JOIN confirmation_submissions cs
      ON cs.registration_id = r.id
    WHERE lower(trim(r.email)) = lower(trim(${email}))
  `) as Array<{ confirmation_campus: string | null; university: string | null }>;

  const confirmationCampuses = rows
    .map((row) => row.confirmation_campus?.trim() ?? '')
    .filter(Boolean);

  if (confirmationCampuses.length > 0) {
    return confirmationCampuses;
  }

  return rows.map((row) => row.university?.trim() ?? '').filter(Boolean);
}
