import {
  CAMPING_LODGING_ADDRESS,
  CAMPING_LODGING_CHOICE,
  EXCLUSIVE_HEALTH_CODES,
  confirmationHealthDetailQuestions,
} from '../constants/confirmationCatalogs';
import type {
  ConfirmationFormData,
  ConfirmationFormErrors,
  ConfirmationHealthConditionCode,
  ConfirmationHealthDetailField,
  ConfirmationPrefillData,
} from '../types/confirmation';

export const PHONE_PATTERN = /^[0-9+ ]{7,20}$/;

function emptyHealthDetails(): Record<ConfirmationHealthDetailField, string> {
  return Object.fromEntries(
    confirmationHealthDetailQuestions.map((question) => [question.field, '']),
  ) as Record<ConfirmationHealthDetailField, string>;
}

function withoutUndefined<T extends object>(input: T | undefined): Partial<T> {
  if (!input) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function createConfirmationInitialData(
  prefill?: Partial<ConfirmationPrefillData>,
  initialData?: Partial<ConfirmationFormData>
): ConfirmationFormData {
  const baseData: ConfirmationFormData = {
    ...emptyHealthDetails(),
    id: prefill?.id ?? '',
    badgeName: prefill?.preferredBadgeName ?? prefill?.legalName ?? '',
    sede: prefill?.sede ?? '',
    pronoun: '',
    pronounOther: '',
    healthConditionCodes: ['NONE'],
    allergiesDetail: prefill?.previousAllergiesDetail ?? '',
    bloodTypeId: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    lodgingChoice: prefill?.previousLodgingChoice ?? '',
    lodgingAddress: '',
    transport: '',
    campingConfirmation: '',
    epsId: '',
    consentHealthData: false,
  };

  const mergedData: ConfirmationFormData = {
    ...baseData,
    ...withoutUndefined(initialData),
  };

  if (!mergedData.id.trim()) {
    mergedData.id = baseData.id;
  }

  if (!mergedData.badgeName.trim()) {
    mergedData.badgeName = baseData.badgeName;
  }

  if (!mergedData.sede.trim()) {
    mergedData.sede = baseData.sede;
  }

  if (mergedData.pronoun !== 'otro') {
    mergedData.pronounOther = '';
  }

  mergedData.healthConditionCodes =
    initialData?.healthConditionCodes && initialData.healthConditionCodes.length > 0
      ? initialData.healthConditionCodes
      : baseData.healthConditionCodes;

  return clearUnusedHealthDetailFields(mergedData);
}

export function normalizeHealthSelection(
  current: ConfirmationHealthConditionCode[],
  clicked: ConfirmationHealthConditionCode
): ConfirmationHealthConditionCode[] {
  if (current.includes(clicked)) {
    const next = current.filter((code) => code !== clicked);
    return next.length > 0 ? next : ['NONE'];
  }

  if (EXCLUSIVE_HEALTH_CODES.includes(clicked)) {
    return [clicked];
  }

  const withoutExclusive = current.filter((code) => !EXCLUSIVE_HEALTH_CODES.includes(code));
  return [...new Set([...withoutExclusive, clicked])];
}

export function clearUnusedHealthDetailFields(
  data: ConfirmationFormData
): ConfirmationFormData {
  const next = { ...data };

  for (const question of confirmationHealthDetailQuestions) {
    if (!next.healthConditionCodes.includes(question.code)) {
      next[question.field] = '';
    }
  }

  if (next.lodgingChoice === CAMPING_LODGING_CHOICE) {
    next.lodgingAddress = CAMPING_LODGING_ADDRESS;
  }

  return next;
}

export function validateConfirmationForm(
  data: ConfirmationFormData
): ConfirmationFormErrors {
  const errors: ConfirmationFormErrors = {};

  if (!data.id.trim()) {
    errors.id = 'El ID es obligatorio.';
  }

  if (!data.badgeName.trim()) {
    errors.badgeName = 'Este campo es obligatorio.';
  }

  if (!data.pronoun.trim()) {
    errors.pronoun = 'Selecciona una opción.';
  }

  if (data.pronoun === 'otro' && !data.pronounOther.trim()) {
    errors.pronounOther = 'Escribe el pronombre con el que te identificas.';
  }

  if (!data.emergencyContactName.trim()) {
    errors.emergencyContactName = 'Este campo es obligatorio.';
  }

  if (!data.emergencyContactRelationship.trim()) {
    errors.emergencyContactRelationship = 'Este campo es obligatorio.';
  }

  if (!data.emergencyContactPhone.trim()) {
    errors.emergencyContactPhone = 'Este campo es obligatorio.';
  } else if (!PHONE_PATTERN.test(data.emergencyContactPhone.trim())) {
    errors.emergencyContactPhone = 'Ingresa un número de contacto válido.';
  }

  if (!data.lodgingChoice.trim()) {
    errors.lodgingChoice = 'Selecciona una opción.';
  }

  if (!data.transport.trim()) {
    errors.transport = 'Selecciona una opción de transporte.';
  }

  if (!data.epsId.trim()) {
    errors.epsId = 'Escribe tu EPS.';
  }

  if (!data.consentHealthData) {
    errors.consentHealthData =
      'Debes autorizar el tratamiento de esta información.';
  }

  for (const question of confirmationHealthDetailQuestions) {
    if (data.healthConditionCodes.includes(question.code) && !data[question.field].trim()) {
      errors[question.field] = question.errorMessage;
    }
  }

  return errors;
}
