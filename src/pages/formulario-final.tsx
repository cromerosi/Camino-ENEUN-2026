import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { ConfirmationAttendeeForm } from '../modules/components/ConfirmationAttendeeForms';
import {
  confirmationHealthDetailQuestions,
  confirmationPronounOptions,
} from '../modules/constants/confirmationCatalogs';
import type {
  ConfirmationCampingConfirmation,
  ConfirmationFormData,
  ConfirmationHealthConditionCode,
  ConfirmationPrefillData,
  ConfirmationTransport,
} from '../modules/types/confirmation';
import Layout from '../layouts/Layout';
import { getSessionCookieName, verifySignedSessionToken } from '../lib/auth';
import { getSql } from '../lib/db';
import { getFinalFormAccessForEmail } from '../lib/final-form-access';
import { isPlainObject } from '../lib/http';

interface FinalFormPageProps {
  email: string;
  fullName: string;
  alreadySubmitted: boolean;
  prefill: Partial<ConfirmationPrefillData>;
  initialData: Partial<ConfirmationFormData> | null;
}

interface RegistrationRow {
  id: number;
  uuid: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  document_number: string | null;
  university: string | null;
  answers: unknown;
  allergy_specify: string | null;
  confirm_answers: unknown;
  has_confirmation_submission: boolean;
  has_attendee_submission: boolean;
}

interface AttendeeRow {
  identification_number: string | null;
  badge_name: string | null;
  sede: string | null;
  pronoun: string | null;
  blood_type_id: string | null;
  eps_id: string | null;
  consent_health_data: boolean | null;
  health_condition_codes: string[] | null;
  health_details: unknown;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  lodging_choice: string | null;
  lodging_address: string | null;
  transport: string | null;
  camping_confirmation: string | null;
  payload: unknown;
}

const PRONOUN_VALUES = new Set(confirmationPronounOptions.map((option) => option.value));

function readString(payload: unknown, keys: string[], fallback = ''): string {
  if (!isPlainObject(payload)) {
    return fallback;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return fallback;
}

function parseStoredTransport(value: unknown): ConfirmationTransport {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'SI' || normalized === 'PROPIOS_MEDIOS') {
    return normalized;
  }

  if (normalized.includes('SUMINISTRADOS POR LA UNIVERSIDAD')) {
    return 'SI';
  }

  if (normalized.includes('PROPIOS RECURSOS')) {
    return 'PROPIOS_MEDIOS';
  }

  return '';
}

function parseStoredCamping(value: unknown): ConfirmationCampingConfirmation {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'YES' || normalized === 'NO' ? normalized : '';
}

/**
 * En attendees.pronoun se guarda el pronombre resuelto (el texto libre cuando
 * se eligió "otro"), así que la selección original se recupera del payload.
 */
function resolveStoredPronoun(attendee: AttendeeRow): { pronoun: string; pronounOther: string } {
  const storedPronoun = attendee.pronoun?.trim() || '';
  const selection = readString(attendee.payload, ['pronoun_selection']).trim();
  const other = readString(attendee.payload, ['pronoun_other', 'pronounOther']).trim();

  if (selection === 'otro' || (!selection && storedPronoun && !PRONOUN_VALUES.has(storedPronoun))) {
    return { pronoun: 'otro', pronounOther: other || storedPronoun };
  }

  return { pronoun: selection || storedPronoun, pronounOther: '' };
}

function buildInitialDataFromAttendee(
  attendee: AttendeeRow,
  prefill: Partial<ConfirmationPrefillData>,
): Partial<ConfirmationFormData> {
  const conditionDetails = isPlainObject(attendee.health_details)
    ? attendee.health_details.condition_details
    : null;

  const healthDetails = Object.fromEntries(
    confirmationHealthDetailQuestions.map((question) => [
      question.field,
      readString(conditionDetails, [question.storageKey]),
    ]),
  );

  const healthConditionCodes = (attendee.health_condition_codes ?? []).filter(
    (code): code is ConfirmationHealthConditionCode => typeof code === 'string',
  );

  return {
    ...healthDetails,
    ...resolveStoredPronoun(attendee),
    id: attendee.identification_number?.trim() || prefill.id || '',
    badgeName: attendee.badge_name?.trim() || '',
    sede: attendee.sede?.trim() || prefill.sede || '',
    healthConditionCodes: healthConditionCodes.length > 0 ? healthConditionCodes : ['NONE'],
    bloodTypeId: attendee.blood_type_id?.trim() || '',
    emergencyContactName: attendee.emergency_contact_name?.trim() || '',
    emergencyContactRelationship: attendee.emergency_contact_relationship?.trim() || '',
    emergencyContactPhone: attendee.emergency_contact_phone?.trim() || '',
    lodgingChoice: attendee.lodging_choice?.trim() || '',
    lodgingAddress: attendee.lodging_address?.trim() || '',
    transport: parseStoredTransport(attendee.transport),
    campingConfirmation: parseStoredCamping(attendee.camping_confirmation),
    epsId: attendee.eps_id?.trim() || '',
    consentHealthData: attendee.consent_health_data === true,
  };
}

export default function FinalFormPage({
  email,
  fullName,
  alreadySubmitted,
  prefill,
  initialData,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState('');

  // Los errores se lanzan para que el formulario los muestre junto al botón de envío.
  async function handleSubmitToApi(payload: ConfirmationFormData) {
    setSuccessMessage('');

    let response: Response;
    try {
      response = await fetch('/api/final-form/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    let message = '';

    if (contentType.includes('application/json')) {
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      message = (result.message ?? result.error ?? '').trim();
    }

    if (response.status === 401) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para enviar el formulario.');
    }

    if (!response.ok) {
      throw new Error(message || 'No se pudo guardar la información.');
    }

    setSuccessMessage(message || 'Información guardada correctamente.');
    await router.push('/');
  }

  return (
    <Layout>
      <main className="relative overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 right-4 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-[140px]"></div>
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-[160px]"></div>
        </div>

        <div className="relative mx-auto max-w-5xl space-y-6">
          <div className="rounded-[32px] bg-[#1f2b5b] p-8 text-white shadow-xl">
            <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide">
              Módulo de confirmación
            </p>

            <h1 className="text-3xl font-bold">
              Confirmación Final de Asistencia al ENEUN 2026 • Manizales
            </h1>

            <p className="mt-3 max-w-3xl text-sm text-white/85">
              Este formulario tiene el objetivo de confirmar oficialmente que usted vendrá al ENEUN en la ciudad de Manizales del 27 al 29 de marzo.
            </p>

            <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
              <p className="font-semibold">Participante: {fullName}</p>
              <p className="break-all text-white/85">{email}</p>
            </div>

            {alreadySubmitted && (
              <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-3 text-sm text-emerald-50">
                Ya tenías un envío previo. Puedes actualizarlo y guardar nuevamente.
              </div>
            )}
          </div>

          <ConfirmationAttendeeForm
            editableId
            prefill={prefill}
            initialData={initialData ?? undefined}
            onSubmitData={handleSubmitToApi}
          />

          {successMessage && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-300/40 bg-emerald-500/15 p-4 text-sm text-emerald-100"
            >
              {successMessage}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<FinalFormPageProps> = async (context) => {
  const authUser = await verifySignedSessionToken(context.req.cookies[getSessionCookieName()]);

  if (!authUser?.email) {
    return {
      redirect: {
        destination: '/landing',
        permanent: false,
      },
    };
  }

  const fallbackName = authUser.name?.trim() || authUser.email;

  const access = await getFinalFormAccessForEmail(authUser.email);
  if (!access.canAccess) {
    return {
      redirect: {
        destination: '/?finalFormStatus=closed',
        permanent: false,
      },
    };
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        r.id,
        r.uuid,
        r.first_name,
        r.last_name,
        r.email,
        r.document_number,
        r.university,
        r.answers,
        r.allergy_specify,
        r.confirm_answers,
        (
          r.confirm_submitted_at IS NOT NULL OR EXISTS (
            SELECT 1
            FROM confirmation_submissions cs_confirm
            WHERE cs_confirm.registration_id = r.id
          )
        ) AS has_confirmation_submission,
        EXISTS (
          SELECT 1
          FROM attendees a
          WHERE a.attendee_id = r.id::text
        ) AS has_attendee_submission
      FROM registrations r
      LEFT JOIN confirmation_submissions cs ON cs.registration_id = r.id
      WHERE lower(trim(r.email)) = lower(trim(${authUser.email}))
      ORDER BY COALESCE(cs.submitted_at, r.confirm_submitted_at, r.registered_at) DESC NULLS LAST
      LIMIT 1
    `) as RegistrationRow[];

    const registration = rows[0];

    // Los correos habilitados manualmente (excepciones) no requieren preconfirmación.
    if (!registration?.has_confirmation_submission && !access.isAllowedWhenClosed) {
      return {
        redirect: {
          destination: '/?finalFormStatus=preconfirmation-required',
          permanent: false,
        },
      };
    }

    const firstName = registration?.first_name?.trim() ?? '';
    const lastName = registration?.last_name?.trim() ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || fallbackName;

    const id =
      registration?.document_number?.trim() || (registration?.id ? String(registration.id) : '');

    const prefill: Partial<ConfirmationPrefillData> = {
      id,
      uuid: registration?.uuid?.trim() || 'No disponible',
      email: registration?.email?.trim() || 'No disponible',
      legalName: fullName,
      preferredBadgeName: firstName || fullName,
      sede: registration?.university?.trim() || 'Sin sede',
      previousLodgingChoice: readString(registration?.confirm_answers, [
        'lodgingChoice',
        'base_hospedaje_situacion',
      ]),
      previousAllergiesDetail:
        registration?.allergy_specify?.trim() ||
        readString(registration?.answers, ['allergy_specify', 'allergiesDetail', 'allergies']),
    };

    let initialData: Partial<ConfirmationFormData> | null = null;

    if (registration?.id) {
      const attendeeRows = (await sql`
        SELECT
          identification_number,
          badge_name,
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
          payload
        FROM attendees
        WHERE attendee_id = ${String(registration.id)}
        ORDER BY updated_at DESC
        LIMIT 1
      `) as AttendeeRow[];

      if (attendeeRows[0]) {
        initialData = buildInitialDataFromAttendee(attendeeRows[0], prefill);
      }
    }

    return {
      props: {
        email: authUser.email,
        fullName,
        alreadySubmitted: Boolean(registration?.has_attendee_submission),
        prefill,
        initialData,
      },
    };
  } catch (error) {
    console.error('Error cargando el formulario final:', error);
    return {
      props: {
        email: authUser.email,
        fullName: fallbackName,
        alreadySubmitted: false,
        prefill: {
          id: '',
          uuid: 'No disponible',
          email: authUser.email,
          legalName: fallbackName,
          preferredBadgeName: fallbackName,
          sede: 'Sin sede',
          previousLodgingChoice: '',
          previousAllergiesDetail: '',
        },
        initialData: null,
      },
    };
  }
};
