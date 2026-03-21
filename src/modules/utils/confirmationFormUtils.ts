import type {
  ConfirmationFormData,
  ConfirmationFormErrors,
  ConfirmationHealthConditionCode,
  ConfirmationPrefillData,
} from '../types/confirmation';

export function createConfirmationInitialData(
  prefill?: Partial<ConfirmationPrefillData>,
  initialData?: Partial<ConfirmationFormData>
): ConfirmationFormData {
  const baseData: ConfirmationFormData = {
    id: prefill?.id ?? '',
    badgeName: prefill?.preferredBadgeName ?? prefill?.legalName ?? '',
    sede: prefill?.sede ?? '',
    pronoun: '',
    pronounOther: '',
    healthConditionCodes: ['NONE'],
    allergiesDetail: prefill?.previousAllergiesDetail ?? '',
    asthmaDetail: '',
    diabetesDetail: '',
    nonNeurotypicalDetail: '',
    epilepsyDetail: '',
    hypertensionDetail: '',
    cardiacConditionsDetail: '',
    reducedMobilityDetail: '',
    visualDisabilityDetail: '',
    hearingDisabilityDetail: '',
    permanentMedicationDetail: '',
    psychosocialDisabilityDetail: '',
    otherHealthConditionDetail: '',
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
    ...initialData,
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
  const isSelected = current.includes(clicked);

  if (isSelected) {
    const next = current.filter((code) => code !== clicked);
    return next.length > 0 ? next : ['NONE'];
  }

  if (clicked === 'NONE' || clicked === 'PREFER_NOT_TO_ANSWER') {
    return [clicked];
  }

  const withoutExclusive = current.filter(
    (code) => code !== 'NONE' && code !== 'PREFER_NOT_TO_ANSWER'
  );

  return [...new Set([...withoutExclusive, clicked])];
}

export function clearUnusedHealthDetailFields(
  data: ConfirmationFormData
): ConfirmationFormData {
  const next = { ...data };

  if (!next.healthConditionCodes.includes('ALLERGIES')) {
    next.allergiesDetail = '';
  }

  if (!next.healthConditionCodes.includes('ASTHMA')) {
    next.asthmaDetail = '';
  }

  if (!next.healthConditionCodes.includes('DIABETES')) {
    next.diabetesDetail = '';
  }

  if (!next.healthConditionCodes.includes('NON_NEUROTYPICAL')) {
    next.nonNeurotypicalDetail = '';
  }

  if (!next.healthConditionCodes.includes('EPILEPSY')) {
    next.epilepsyDetail = '';
  }

  if (!next.healthConditionCodes.includes('HYPERTENSION')) {
    next.hypertensionDetail = '';
  }

  if (!next.healthConditionCodes.includes('CARDIAC')) {
    next.cardiacConditionsDetail = '';
  }

  if (!next.healthConditionCodes.includes('REDUCED_MOBILITY')) {
    next.reducedMobilityDetail = '';
  }

  if (!next.healthConditionCodes.includes('VISUAL_DISABILITY')) {
    next.visualDisabilityDetail = '';
  }

  if (!next.healthConditionCodes.includes('HEARING_DISABILITY')) {
    next.hearingDisabilityDetail = '';
  }

  if (!next.healthConditionCodes.includes('PERMANENT_MEDICATION')) {
    next.permanentMedicationDetail = '';
  }

  if (!next.healthConditionCodes.includes('PSYCHOSOCIAL_DISABILITY')) {
    next.psychosocialDisabilityDetail = '';
  }

  if (!next.healthConditionCodes.includes('OTHER')) {
    next.otherHealthConditionDetail = '';
  }

  if (next.lodgingChoice === 'Planea Acampar') {
    next.lodgingAddress = 'UNAL, Campus La Nubia';
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
  } else if (!/^[0-9+ ]{7,20}$/.test(data.emergencyContactPhone.trim())) {
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

  if (
    data.healthConditionCodes.includes('ALLERGIES') &&
    !data.allergiesDetail.trim()
  ) {
    errors.allergiesDetail = 'Especifica las alergias a reportar.';
  }

  if (data.healthConditionCodes.includes('ASTHMA') && !data.asthmaDetail.trim()) {
    errors.asthmaDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('DIABETES') &&
    !data.diabetesDetail.trim()
  ) {
    errors.diabetesDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('NON_NEUROTYPICAL') &&
    !data.nonNeurotypicalDetail.trim()
  ) {
    errors.nonNeurotypicalDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('EPILEPSY') &&
    !data.epilepsyDetail.trim()
  ) {
    errors.epilepsyDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('HYPERTENSION') &&
    !data.hypertensionDetail.trim()
  ) {
    errors.hypertensionDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('CARDIAC') &&
    !data.cardiacConditionsDetail.trim()
  ) {
    errors.cardiacConditionsDetail =
      'Describe las condiciones cardíacas a reportar.';
  }

  if (
    data.healthConditionCodes.includes('REDUCED_MOBILITY') &&
    !data.reducedMobilityDetail.trim()
  ) {
    errors.reducedMobilityDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('VISUAL_DISABILITY') &&
    !data.visualDisabilityDetail.trim()
  ) {
    errors.visualDisabilityDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('HEARING_DISABILITY') &&
    !data.hearingDisabilityDetail.trim()
  ) {
    errors.hearingDisabilityDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('PERMANENT_MEDICATION') &&
    !data.permanentMedicationDetail.trim()
  ) {
    errors.permanentMedicationDetail =
      'Indica cuál medicamento tomas y para qué.';
  }

  if (
    data.healthConditionCodes.includes('PSYCHOSOCIAL_DISABILITY') &&
    !data.psychosocialDisabilityDetail.trim()
  ) {
    errors.psychosocialDisabilityDetail =
      'Cuéntanos brevemente qué ajuste o consideración debemos tener.';
  }

  if (
    data.healthConditionCodes.includes('OTHER') &&
    !data.otherHealthConditionDetail.trim()
  ) {
    errors.otherHealthConditionDetail =
      'Especifica la otra condición a reportar.';
  }

  return errors;
}
