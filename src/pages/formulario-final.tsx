import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { ConfirmationAttendeeForm } from '../modules/components/ConfirmationAttendeeForms';
import type {
  ConfirmationFormData,
  ConfirmationPrefillData,
} from '../modules/types/confirmation';
import Layout from '../layouts/Layout';
import { getSessionCookieName, verifySignedSessionToken } from '../lib/auth';
import { getSql } from '../lib/db';
import { getFinalFormAccessForEmail } from '../lib/final-form-access';

type SaveStatus = 'idle' | 'success' | 'error';

interface FinalFormPageProps {
  email: string;
  fullName: string;
  alreadySubmitted: boolean;
  prefill: Partial<ConfirmationPrefillData>;
  initialData: Partial<ConfirmationFormData> | null;
}

function readObject(payload: unknown, key: string): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseStoredTransport(value: unknown): '' | 'SI' | 'PROPIOS_MEDIOS' {
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

function parseStoredCamping(value: unknown): '' | 'YES' | 'NO' {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'YES' || normalized === 'NO') {
    return normalized;
  }

  return '';
}

function readString(payload: unknown, keys: string[], fallback = ''): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return fallback;
}

function readBoolean(payload: unknown, key: string): boolean | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readHealthCodes(payload: unknown): ConfirmationFormData['healthConditionCodes'] | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const raw = (payload as Record<string, unknown>).healthConditionCodes;
  if (!Array.isArray(raw)) {
    return undefined;
  }

  return raw.filter((item): item is ConfirmationFormData['healthConditionCodes'][number] => typeof item === 'string');
}

function readCampingConfirmation(payload: unknown): '' | 'YES' | 'NO' | undefined {
  const value = readString(payload, ['campingConfirmation']).trim().toUpperCase();
  if (!value) {
    return '';
  }
  if (value === 'YES' || value === 'NO') {
    return value;
  }
  return undefined;
}

function readTransport(payload: unknown): '' | 'SI' | 'PROPIOS_MEDIOS' | undefined {
  const value = readString(payload, ['transport']).trim().toUpperCase();
  if (!value) {
    return '';
  }
  if (value === 'SI' || value === 'PROPIOS_MEDIOS') {
    return value;
  }
  return undefined;
}

function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

function extractInitialData(payload: unknown): Partial<ConfirmationFormData> {
  const healthConditionCodes = readHealthCodes(payload);
  const consentHealthData = readBoolean(payload, 'consentHealthData');
  const campingConfirmation = readCampingConfirmation(payload);
  const transport = readTransport(payload);

  return omitUndefined({
    id: readString(payload, ['id']),
    badgeName: readString(payload, ['badgeName']),
    sede: readString(payload, ['sede']),
    pronoun: readString(payload, ['pronoun']),
    pronounOther: readString(payload, ['pronounOther']),
    healthConditionCodes,
    allergiesDetail: readString(payload, ['allergiesDetail']),
    asthmaDetail: readString(payload, ['asthmaDetail']),
    diabetesDetail: readString(payload, ['diabetesDetail']),
    nonNeurotypicalDetail: readString(payload, ['nonNeurotypicalDetail']),
    epilepsyDetail: readString(payload, ['epilepsyDetail']),
    hypertensionDetail: readString(payload, ['hypertensionDetail']),
    cardiacConditionsDetail: readString(payload, ['cardiacConditionsDetail']),
    reducedMobilityDetail: readString(payload, ['reducedMobilityDetail']),
    visualDisabilityDetail: readString(payload, ['visualDisabilityDetail']),
    hearingDisabilityDetail: readString(payload, ['hearingDisabilityDetail']),
    permanentMedicationDetail: readString(payload, ['permanentMedicationDetail']),
    psychosocialDisabilityDetail: readString(payload, ['psychosocialDisabilityDetail']),
    otherHealthConditionDetail: readString(payload, ['otherHealthConditionDetail']),
    bloodTypeId: readString(payload, ['bloodTypeId']),
    emergencyContactName: readString(payload, ['emergencyContactName']),
    emergencyContactRelationship: readString(payload, ['emergencyContactRelationship']),
    emergencyContactPhone: readString(payload, ['emergencyContactPhone']),
    lodgingChoice: readString(payload, ['lodgingChoice']),
    lodgingAddress: readString(payload, ['lodgingAddress']),
    transport,
    campingConfirmation,
    epsId: readString(payload, ['epsId']),
    consentHealthData,
  });
}

export default function FinalFormPage({
  email,
  fullName,
  alreadySubmitted,
  prefill,
  initialData,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  async function handleSubmitToApi(payload: ConfirmationFormData) {
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const response = await fetch('/api/final-form/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') ?? '';
      let message = '';

      if (contentType.includes('application/json')) {
        const result = (await response.json()) as { message?: string; error?: string };
        message = result.message ?? result.error ?? '';
      } else {
        message = await response.text();
      }

      if (!response.ok) {
        const finalMessage =
          message.trim() || 'No se pudo guardar la información.';
        setSaveStatus('error');
        setSaveMessage(finalMessage);
        throw new Error(finalMessage);
      }

      setSaveStatus('success');
      setSaveMessage(message.trim() || 'Información guardada correctamente.');
      await router.push('/');
    } catch (error) {
      const finalMessage =
        error instanceof Error
          ? error.message
          : 'No se pudo conectar con el servidor.';

      setSaveStatus('error');
      setSaveMessage(finalMessage);
      throw error;
    }
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
              Este formulario tiene el objetivo de confirmar oficialmente que usted vendrá al ENEUN en la ciudad de Manizales del 27 al 29 de Marzo.
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

          {saveStatus !== 'idle' && (
            <div
              className={`rounded-2xl border p-4 text-sm ${
                saveStatus === 'success'
                  ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-300/40 bg-rose-500/15 text-rose-100'
              }`}
            >
              {saveMessage}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<FinalFormPageProps> = async (context) => {
  const token = context.req.cookies[getSessionCookieName()];
  const authUser = await verifySignedSessionToken(token);

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
    const rows = await sql`
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
        r.final_submitted_at,
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
    ` as Array<{
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
      final_submitted_at: string | Date | null;
      has_confirmation_submission: boolean;
      has_attendee_submission: boolean;
    }>;

    const registration = rows[0];
    const shouldBypassPreconfirmation = access.isAllowedWhenClosed;

    if (!registration?.has_confirmation_submission && !shouldBypassPreconfirmation) {
      return {
        redirect: {
          destination: '/?finalFormStatus=preconfirmation-required',
          permanent: false,
        },
      };
    }

    const firstName = registration?.first_name?.trim() ?? '';
    const lastName = registration?.last_name?.trim() ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || fallbackName;

    const id =
      (registration?.document_number?.trim() || '') ||
      (registration?.id ? String(registration.id) : '');

    const previousLodgingChoice = readString(registration?.confirm_answers, [
      'lodgingChoice',
      'base_hospedaje_situacion',
    ]);

    const previousAllergiesDetail =
      (registration?.allergy_specify?.trim() || '') ||
      readString(registration?.answers, ['allergy_specify', 'allergiesDetail', 'allergies']);

    const prefill: Partial<ConfirmationPrefillData> = {
      id,
      uuid: registration?.uuid?.trim() || 'No disponible',
      email: registration?.email?.trim() || 'No disponible',
      legalName: fullName,
      preferredBadgeName: firstName || fullName,
      sede: registration?.university?.trim() || 'Sin sede',
      previousLodgingChoice,
      previousAllergiesDetail,
    };

    let initialData: Partial<ConfirmationFormData> | null = null;

    if (registration?.id) {
      const attendeeRows = await sql`
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
      ` as Array<{
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
      }>;

      const attendee = attendeeRows[0];
      if (attendee) {
        const payloadRecord =
          attendee.payload && typeof attendee.payload === 'object' && !Array.isArray(attendee.payload)
            ? (attendee.payload as Record<string, unknown>)
            : null;

        const healthDetails = readObject(attendee.health_details, 'condition_details');

        initialData = {
          id: attendee.identification_number?.trim() || prefill.id || '',
          badgeName: attendee.badge_name?.trim() || '',
          sede: attendee.sede?.trim() || prefill.sede || '',
          pronoun: attendee.pronoun?.trim() || '',
          pronounOther:
            readString(payloadRecord, ['pronoun_other', 'pronounOther']) ||
            (attendee.pronoun?.trim().toLowerCase() === 'otro' ? attendee.pronoun?.trim() || '' : ''),
          healthConditionCodes:
            (Array.isArray(attendee.health_condition_codes)
              ? attendee.health_condition_codes.filter((code): code is ConfirmationFormData['healthConditionCodes'][number] => typeof code === 'string')
              : []) || ['NONE'],
          allergiesDetail: readString(healthDetails, ['allergies']),
          asthmaDetail: readString(healthDetails, ['asthma']),
          diabetesDetail: readString(healthDetails, ['diabetes']),
          nonNeurotypicalDetail: readString(healthDetails, ['non_neurotypical']),
          epilepsyDetail: readString(healthDetails, ['epilepsy']),
          hypertensionDetail: readString(healthDetails, ['hypertension']),
          cardiacConditionsDetail: readString(healthDetails, ['cardiac_conditions']),
          reducedMobilityDetail: readString(healthDetails, ['reduced_mobility']),
          visualDisabilityDetail: readString(healthDetails, ['visual_disability']),
          hearingDisabilityDetail: readString(healthDetails, ['hearing_disability']),
          permanentMedicationDetail: readString(healthDetails, ['permanent_medication']),
          psychosocialDisabilityDetail: readString(healthDetails, ['psychosocial_disability']),
          otherHealthConditionDetail: readString(healthDetails, ['other']),
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
  } catch {
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
