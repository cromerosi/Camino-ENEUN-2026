import { getSql, withDbRetry } from './db';
import { getTrainingSql } from './training-db';
import { ENEUN_PROCESS_NODES, type EneunJourneyStepState } from './eneun-schema';
import { APP_TIME_ZONE, getDatePartsInAppTimeZone } from './timezone';

const ATTENDANCE_DEBUG_ENABLED =
  process.env.DEBUG_ATTENDANCE_LOGS === 'true' || process.env.NODE_ENV !== 'production';

function maskForLogs(value: string): string {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function attendanceDebugLog(message: string, details?: Record<string, unknown>): void {
  if (!ATTENDANCE_DEBUG_ENABLED) {
    return;
  }

  if (details) {
    console.log(`[attendance-debug] ${message}`, details);
    return;
  }

  console.log(`[attendance-debug] ${message}`);
}

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
  attendee_submitted_at?: string | Date | null;
  confirmation_campus?: string | null;
  attendee_identification_number?: string | null;
  attendee_lodging_choice?: string | null;
  attendee_camping_confirmation?: string | null;
  attendee_updated_at?: string | Date | null;
}

interface ValidationProgress {
  totalValidations: number;
  completedValidations: number;
}

interface TrainingStatus {
  completada: boolean;
  updated_at: string | Date | null;
}

export interface LocalAuthUser {
  sub: string;
  email: string;
  name: string;
}

export type AttendanceVisualStatus = 'present' | 'absent' | 'late' | 'unavailable';
export type AttendanceDayKey = 'viernes' | 'sabado' | 'domingo';
export type AttendanceShiftKey = 'manana' | 'tarde';
export type AttendanceTypeKey = 'entrada' | 'salida';

export interface AttendanceSlotStatus {
  day: AttendanceDayKey;
  shift: AttendanceShiftKey;
  type: AttendanceTypeKey;
  status: AttendanceVisualStatus;
  hourLabel: string | null;
  timestamp: string | null;
}

export interface AttendanceMatrix {
  totalSlots: number;
  completedSlots: number;
  lateSlots: number;
  missingSlots: number;
  slots: AttendanceSlotStatus[];
  updatedAt: string;
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

function parseCampingFromAttendee(row: RegistrationRow | undefined): boolean | null {
  if (!row) {
    return null;
  }

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

  if (lodgingChoice) {
    return false;
  }

  return null;
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

  const dateParts = getDatePartsInAppTimeZone(value);
  if (!dateParts) {
    return null;
  }

  return `${dateParts.day}·${dateParts.month}`;
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

function normalizeAttendanceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function getBooleanField(record: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }
    if (typeof value === 'string') {
      const normalized = normalizeAttendanceText(value);
      if (['true', 'si', 'yes', 'ok', 'completo', 'completado', 'presente'].includes(normalized)) {
        return true;
      }
      if (['false', 'no', 'ausente', 'falta', 'pendiente'].includes(normalized)) {
        return false;
      }
    }
  }
  return null;
}

function parseAttendanceDay(value: string | null): AttendanceDayKey | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeAttendanceText(value);
  if (normalized.includes('viernes') || normalized.includes('dia 1') || normalized.includes('27')) {
    return 'viernes';
  }
  if (normalized.includes('sabado') || normalized.includes('dia 2') || normalized.includes('28')) {
    return 'sabado';
  }
  if (normalized.includes('domingo') || normalized.includes('dia 3') || normalized.includes('29')) {
    return 'domingo';
  }

  return null;
}

function parseAttendanceShift(value: string | null): AttendanceShiftKey | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeAttendanceText(value);
  if (normalized.includes('manana') || normalized.includes('mañana') || normalized.includes('am')) {
    return 'manana';
  }
  if (normalized.includes('tarde') || normalized.includes('pm')) {
    return 'tarde';
  }

  return null;
}

function parseAttendanceType(value: string | null): AttendanceTypeKey | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeAttendanceText(value);
  const hasEntrada =
    normalized.includes('entrada') || normalized.includes('ingreso') || normalized.includes('checkin');
  const hasSalida =
    normalized.includes('salida') || normalized.includes('egreso') || normalized.includes('checkout');

  // Si el texto contiene ambas palabras, es ambiguo y preferimos fallback por timestamp.
  if (hasEntrada && hasSalida) {
    return null;
  }

  if (hasEntrada) {
    return 'entrada';
  }
  if (hasSalida) {
    return 'salida';
  }

  return null;
}

function parseAttendanceStatus(record: Record<string, unknown>): AttendanceVisualStatus | null {
  const explicitStatus = getStringField(record, ['status', 'estado', 'resultado', 'tipo_estado']);
  if (explicitStatus) {
    const normalized = normalizeAttendanceText(explicitStatus);
    if (['late', 'tarde'].includes(normalized)) {
      return 'late';
    }
    if (['present', 'presente', 'ok', 'completo', 'completado'].includes(normalized)) {
      return 'present';
    }
    if (['absent', 'ausente', 'falta', 'pendiente', 'no'].includes(normalized)) {
      return 'absent';
    }
  }

  const check = getBooleanField(record, ['is_checked', 'checked', 'asistio', 'registrado', 'is_completed']);
  if (check === true) {
    return 'present';
  }
  if (check === false) {
    return 'absent';
  }

  return null;
}

function inferAttendanceSlotByTimestamp(
  rawTimestamp: string | null,
): { day: AttendanceDayKey; shift: AttendanceShiftKey; type: AttendanceTypeKey } | null {
  if (!rawTimestamp) {
    return null;
  }

  const parsedDate = new Date(rawTimestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: APP_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsedDate);

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const hourRaw = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minuteRaw = parts.find((part) => part.type === 'minute')?.value ?? '';

  const day = parseAttendanceDay(weekday);
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  if (!day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const totalMinutes = hour * 60 + minute;

  // Ventanas amplias para tolerar diferencias operativas en el escaneo real.
  if (totalMinutes <= 9 * 60 + 30) {
    return { day, shift: 'manana', type: 'entrada' };
  }

  if (totalMinutes <= 14 * 60) {
    return { day, shift: 'manana', type: 'salida' };
  }

  if (totalMinutes <= 16 * 60 + 30) {
    return { day, shift: 'tarde', type: 'entrada' };
  }

  return { day, shift: 'tarde', type: 'salida' };
}

function pickRawAttendanceFields(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    marked_at: payload.marked_at ?? null,
    day: payload.day ?? payload.dia ?? payload.dia_nombre ?? payload.fecha_dia ?? payload.day_name ?? payload.fecha ?? null,
    shift: payload.shift ?? payload.jornada ?? payload.session ?? payload.franja ?? payload.bloque ?? payload.periodo ?? null,
    type:
      payload.type ?? payload.tipo ?? payload.tipo_asistencia ?? payload.registro_tipo ?? payload.movimiento ?? payload.evento ?? null,
    status: payload.status ?? payload.estado ?? payload.resultado ?? payload.tipo_estado ?? null,
    checked:
      payload.is_checked ?? payload.checked ?? payload.asistio ?? payload.registrado ?? payload.is_completed ?? null,
  };
}

function buildSearchableAttendanceText(record: Record<string, unknown>): string {
  const tokens = Object.values(record)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => normalizeAttendanceText(value))
    .filter((value) => value.length > 0);

  return tokens.join(' ');
}

function toIsoTimestamp(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function toHourLabel(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) {
    return null;
  }

  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  // Ajuste solicitado: el servidor registra con 5 horas de diferencia.
  const adjustedDate = new Date(parsedDate.getTime() - 5 * 60 * 60 * 1000);

  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(adjustedDate);
}

function getSlotAvailableAt(day: AttendanceDayKey, shift: AttendanceShiftKey, type: AttendanceTypeKey): string {
  const dateByDay: Record<AttendanceDayKey, string> = {
    viernes: '2026-03-27',
    sabado: '2026-03-28',
    domingo: '2026-03-29',
  };

  const hourMap: Record<AttendanceShiftKey, Record<AttendanceTypeKey, string>> = {
    manana: {
      entrada: '06:00:00',
      salida: '11:30:00',
    },
    tarde: {
      entrada: '13:00:00',
      salida: '17:00:00',
    },
  };

  return `${dateByDay[day]}T${hourMap[shift][type]}-05:00`;
}

function buildEmptyAttendanceSlots(): AttendanceSlotStatus[] {
  const dayOrder: AttendanceDayKey[] = ['viernes', 'sabado', 'domingo'];
  const shiftOrder: AttendanceShiftKey[] = ['manana', 'tarde'];
  const typeOrder: AttendanceTypeKey[] = ['entrada', 'salida'];

  const now = new Date();
  const slots: AttendanceSlotStatus[] = [];

  for (const day of dayOrder) {
    for (const shift of shiftOrder) {
      for (const type of typeOrder) {
        const availableAt = new Date(getSlotAvailableAt(day, shift, type));
        const status: AttendanceVisualStatus = now >= availableAt ? 'absent' : 'unavailable';
        slots.push({
          day,
          shift,
          type,
          status,
          hourLabel: null,
          timestamp: null,
        });
      }
    }
  }

  return slots;
}

export async function getAttendanceMatrixByUuid(uuid: string): Promise<AttendanceMatrix> {
  const emptySlots = buildEmptyAttendanceSlots();
  const baseResult: AttendanceMatrix = {
    totalSlots: emptySlots.length,
    completedSlots: 0,
    lateSlots: 0,
    missingSlots: emptySlots.filter((slot) => slot.status === 'absent').length,
    slots: emptySlots,
    updatedAt: new Date().toISOString(),
  };

  const normalizedUuid = uuid.trim();
  if (!normalizedUuid) {
    attendanceDebugLog('No UUID provided for attendance matrix query');
    return baseResult;
  }

  attendanceDebugLog('Starting attendance query by UUID', {
    uuid: maskForLogs(normalizedUuid),
  });

  try {
    const rows = await withDbRetry(async (sql) => {
      const result = (await sql`
        SELECT row_to_json(ar) as payload
        FROM asistencia_registros ar
        WHERE lower(trim(coalesce(ar.attendee_uuid::text, ''))) = lower(trim(${normalizedUuid}))
        ORDER BY ar.marked_at DESC NULLS LAST, ar.ctid DESC
        LIMIT 150
      `) as Array<{ payload: unknown }>;

      return result;
    });

    attendanceDebugLog('Attendance rows fetched', {
      uuid: maskForLogs(normalizedUuid),
      rows: rows.length,
    });

    const slotsByKey = new Map<string, AttendanceSlotStatus>(
      baseResult.slots.map((slot) => [`${slot.day}:${slot.shift}:${slot.type}`, { ...slot }]),
    );
    let mappedRows = 0;
    let skippedRows = 0;
    const rowDebug: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const payload = asRecord(row.payload);
      const rawTimestamp =
        getStringField(payload, ['marked_at', 'registered_at', 'timestamp', 'hora_registro', 'fecha_hora']) ??
        null;
      const inferredSlot = inferAttendanceSlotByTimestamp(rawTimestamp);
      const explicitDay = parseAttendanceDay(
        getStringField(payload, ['day', 'dia', 'dia_nombre', 'fecha_dia', 'day_name', 'fecha']),
      );
      const explicitShift = parseAttendanceShift(
        getStringField(payload, ['shift', 'jornada', 'session', 'franja', 'bloque', 'periodo']),
      );
      const explicitType = parseAttendanceType(
        getStringField(payload, ['type', 'tipo', 'tipo_asistencia', 'registro_tipo', 'movimiento', 'evento']),
      );

      // Priorizamos el slot inferido por marked_at para evitar inconsistencias de etiquetas en texto.
      const day = inferredSlot?.day ?? explicitDay ?? null;
      const shift = inferredSlot?.shift ?? explicitShift ?? null;
      const type = inferredSlot?.type ?? explicitType ?? null;

      if (!day || !shift || !type) {
        skippedRows += 1;
        rowDebug.push({
          raw: pickRawAttendanceFields(payload),
          isoTimestamp: toIsoTimestamp(rawTimestamp),
          explicitDay,
          explicitShift,
          explicitType,
          inferredSlot,
          resolved: null,
          skipped: true,
          reason: 'missing-day-shift-type',
        });
        continue;
      }

      const key = `${day}:${shift}:${type}`;
      if (!slotsByKey.has(key)) {
        rowDebug.push({
          raw: pickRawAttendanceFields(payload),
          isoTimestamp: toIsoTimestamp(rawTimestamp),
          explicitDay,
          explicitShift,
          explicitType,
          inferredSlot,
          resolved: { day, shift, type, key },
          skipped: true,
          reason: 'slot-key-not-found',
        });
        continue;
      }

      const isoTimestamp = toIsoTimestamp(rawTimestamp);

      const parsedStatus = parseAttendanceStatus(payload) ?? 'present';

      const currentSlot = slotsByKey.get(key);
      if (!currentSlot) {
        continue;
      }

      // Las filas vienen en orden descendente por marked_at; preservamos la más reciente por slot.
      if (currentSlot.timestamp) {
        rowDebug.push({
          raw: pickRawAttendanceFields(payload),
          isoTimestamp,
          explicitDay,
          explicitShift,
          explicitType,
          inferredSlot,
          resolved: { day, shift, type, key },
          skipped: true,
          reason: 'slot-already-filled',
        });
        continue;
      }

      currentSlot.status = parsedStatus;
      currentSlot.timestamp = isoTimestamp;
      currentSlot.hourLabel = toHourLabel(isoTimestamp);
      slotsByKey.set(key, currentSlot);
      mappedRows += 1;
      rowDebug.push({
        raw: pickRawAttendanceFields(payload),
        isoTimestamp,
        explicitDay,
        explicitShift,
        explicitType,
        inferredSlot,
        resolved: { day, shift, type, key, status: parsedStatus, hourLabel: currentSlot.hourLabel },
        skipped: false,
      });
    }

    const orderedSlots = baseResult.slots.map((slot) => {
      const key = `${slot.day}:${slot.shift}:${slot.type}`;
      return slotsByKey.get(key) ?? slot;
    });

    const completedSlots = orderedSlots.filter((slot) => slot.status === 'present').length;
    const lateSlots = orderedSlots.filter((slot) => slot.status === 'late').length;
    const missingSlots = orderedSlots.filter((slot) => slot.status === 'absent').length;

    attendanceDebugLog('Attendance slots built', {
      uuid: maskForLogs(normalizedUuid),
      fetchedRows: rows.length,
      mappedRows,
      skippedRows,
      completedSlots,
      lateSlots,
      missingSlots,
      totalSlots: orderedSlots.length,
    });
    attendanceDebugLog('Attendance row mapping details', {
      uuid: maskForLogs(normalizedUuid),
      rows: rowDebug,
    });

    return {
      totalSlots: orderedSlots.length,
      completedSlots,
      lateSlots,
      missingSlots,
      slots: orderedSlots,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    attendanceDebugLog('Attendance query failed', {
      uuid: maskForLogs(normalizedUuid),
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return baseResult;
  }
}

async function getLatestAttendanceUuidByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    attendanceDebugLog('No email provided when resolving attendees UUID');
    return null;
  }

  attendanceDebugLog('Resolving UUID from attendees by email', {
    email: maskForLogs(normalizedEmail),
  });

  try {
    const rows = await withDbRetry(async (sql) => {
      const result = (await sql`
        SELECT
          nullif(trim(coalesce(a.uuid::text, '')), '') AS attendance_uuid
        FROM attendees a
        INNER JOIN registrations r
          ON a.attendee_id = r.id::text
        WHERE lower(trim(coalesce(r.email, ''))) = lower(trim(${normalizedEmail}))
        ORDER BY a.updated_at DESC NULLS LAST
        LIMIT 1
      `) as Array<{ attendance_uuid: string | null }>;

      return result;
    });

    attendanceDebugLog('UUID resolution query finished', {
      email: maskForLogs(normalizedEmail),
      found: Boolean(rows[0]?.attendance_uuid),
      uuid: maskForLogs(rows[0]?.attendance_uuid ?? ''),
    });

    return rows[0]?.attendance_uuid ?? null;
  } catch (error) {
    attendanceDebugLog('UUID resolution failed', {
      email: maskForLogs(normalizedEmail),
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
}

export async function getAttendanceMatrixByEmail(email: string): Promise<AttendanceMatrix> {
  const latestUuid = await getLatestAttendanceUuidByEmail(email);
  if (!latestUuid) {
    attendanceDebugLog('No attendees UUID found; returning empty attendance matrix', {
      email: maskForLogs(email),
    });
    return getAttendanceMatrixByUuid('');
  }

  attendanceDebugLog('Resolved attendees UUID; querying attendance', {
    email: maskForLogs(email),
    uuid: maskForLogs(latestUuid),
  });

  return getAttendanceMatrixByUuid(latestUuid);
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

async function getTrainingStatusById(registrationId: number): Promise<TrainingStatus | null> {
  try {
    const sql = getTrainingSql();
    const rows = (await sql`
      SELECT completada, updated_at
      FROM student_capacitaciones
      WHERE student_registration_id = ${registrationId}
      LIMIT 1
    `) as Array<{ completada: boolean; updated_at: string | Date | null }>;

    if (rows.length === 0) {
      return null;
    }

    return {
      completada: rows[0].completada,
      updated_at: rows[0].updated_at,
    };
  } catch (error) {
    console.error('Error fetching training status:', error);
    return null;
  }
}

function buildJourneyStepsFromRegistration(
  registration: RegistrationRow | undefined,
  validationProgress: ValidationProgress,
  trainingStatus: TrainingStatus | null,
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
  const finalSubmissionDate = toJourneyDate(registration.attendee_submitted_at);
  const trainingDate = toJourneyDate(trainingStatus?.updated_at);

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
      status: trainingStatus?.completada ? 'green' : 'purple',
      detail: trainingStatus?.completada
        ? trainingDate
          ? `Completado el ${trainingDate}`
          : 'Completado'
        : 'Ya está en curso. Haz clic aquí para ingresar.',
    },
    {
      label: 'Formulario final',
      status: registration.attendee_submitted_at ? 'green' : 'purple',
      detail: registration.attendee_submitted_at
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
        r.id,
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
        a.camping_confirmation AS attendee_camping_confirmation,
        a.updated_at AS attendee_updated_at
      FROM registrations r
      LEFT JOIN attendees a
        ON a.attendee_id = r.id::text
      WHERE lower(r.email) = lower(${email})
      ORDER BY COALESCE(a.updated_at, r.registered_at) DESC NULLS LAST, r.registered_at DESC
      LIMIT 1
    `) as RegistrationRow[];

    const registration = registrationRows[0];
    if (!registration) {
      return fallback;
    }

    const firstName = registration.first_name?.trim() ?? '';
    const lastName = registration.last_name?.trim() ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;

    const campingFromAttendee = parseCampingFromAttendee(registration);
    const resolvedDocumentNumber =
      registration.attendee_identification_number?.trim() ||
      registration.document_number?.trim() ||
      'No disponible';

    return {
      fullName,
      documentType: registration.document_type?.trim() || 'No disponible',
      documentNumber: resolvedDocumentNumber,
      site: registration.university?.trim() || 'No disponible',
      faculty: registration.faculty?.trim() || 'No disponible',
      camping:
        campingFromAttendee ??
        resolveCamping(registration.ticket_type, registration.confirm_answers),
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
      return buildJourneyStepsFromRegistration(
        undefined,
        {
          totalValidations: 0,
          completedValidations: 0,
        },
        null,
      );
    }

    const campus = registration.confirmation_campus?.trim() || registration.university?.trim() || '';
    const validationProgress = campus
      ? await getSedeValidationProgress(registration.id, campus)
      : { totalValidations: 0, completedValidations: 0 };

    const attendeeRows = (await sql`
      SELECT updated_at
      FROM attendees
      WHERE attendee_id = ${String(registration.id)}
      ORDER BY updated_at DESC
      LIMIT 1
    `) as Array<{ updated_at: string | Date | null }>;

    const trainingStatus = await getTrainingStatusById(registration.id);

    const registrationWithFinalStep: RegistrationRow = {
      ...registration,
      attendee_submitted_at: attendeeRows[0]?.updated_at ?? null,
    };

    return buildJourneyStepsFromRegistration(
      registrationWithFinalStep,
      validationProgress,
      trainingStatus,
    );
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
        r.email,
        r.first_name,
        r.last_name,
        r.document_number,
        a.identification_number AS attendee_identification_number
      FROM registrations r
      LEFT JOIN attendees a
        ON a.attendee_id = r.id::text
      WHERE lower(trim(r.email)) = lower(trim(${email}))
        AND (
          regexp_replace(coalesce(a.identification_number, r.document_number, ''), '[^0-9]', '', 'g') = regexp_replace(${normalizedDocument}, '[^0-9]', '', 'g')
          OR lower(trim(coalesce(a.identification_number, r.document_number, ''))) = lower(trim(${normalizedDocument}))
        )
      ORDER BY COALESCE(a.updated_at, r.registered_at) DESC NULLS LAST, r.registered_at DESC
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
