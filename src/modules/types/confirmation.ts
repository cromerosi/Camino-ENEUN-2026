export type ConfirmationHealthConditionCode =
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

export type ConfirmationHealthDetailField =
  | 'allergiesDetail'
  | 'asthmaDetail'
  | 'diabetesDetail'
  | 'nonNeurotypicalDetail'
  | 'epilepsyDetail'
  | 'hypertensionDetail'
  | 'cardiacConditionsDetail'
  | 'reducedMobilityDetail'
  | 'visualDisabilityDetail'
  | 'hearingDisabilityDetail'
  | 'permanentMedicationDetail'
  | 'psychosocialDisabilityDetail'
  | 'otherHealthConditionDetail';

export type ConfirmationHealthOption = {
  code: ConfirmationHealthConditionCode;
  label: string;
  requiresDetail?: boolean;
  detailField?: ConfirmationHealthDetailField;
  exclusive?: boolean;
};

/** Pregunta de detalle que aparece al seleccionar una condición de salud. */
export type ConfirmationHealthDetailQuestion = {
  code: ConfirmationHealthConditionCode;
  field: ConfirmationHealthDetailField;
  /** Clave con la que se guarda en attendees.health_details.condition_details. */
  storageKey: string;
  label: string;
  placeholder: string;
  errorMessage: string;
};

export type ConfirmationBloodType = {
  id: string;
  label: string;
};

export type ConfirmationLodgingOption = {
  value: string;
  label: string;
};

export type ConfirmationEpsOption = {
  id: string;
  name: string;
};

export type ConfirmationPronounOption = {
  value: string;
  label: string;
};

export type ConfirmationRelationshipOption = {
  value: string;
  label: string;
};

export type ConfirmationPrefillData = {
  id: string;
  uuid?: string;
  email?: string;
  legalName: string;
  preferredBadgeName: string;
  sede: string;
  previousLodgingChoice: string;
  previousAllergiesDetail?: string;
};

export type ConfirmationTransport = '' | 'SI' | 'PROPIOS_MEDIOS';
export type ConfirmationCampingConfirmation = '' | 'YES' | 'NO';

export type ConfirmationFormData = Record<ConfirmationHealthDetailField, string> & {
  id: string;
  badgeName: string;
  sede: string;
  pronoun: string;
  pronounOther: string;
  healthConditionCodes: ConfirmationHealthConditionCode[];
  bloodTypeId: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  lodgingChoice: string;
  lodgingAddress: string;
  transport: ConfirmationTransport;
  campingConfirmation: ConfirmationCampingConfirmation;
  epsId: string;
  consentHealthData: boolean;
};

export type ConfirmationFormErrors = Partial<
  Record<keyof ConfirmationFormData, string>
>;

export type ConfirmationFormProps = {
  prefill?: Partial<ConfirmationPrefillData>;
  initialData?: Partial<ConfirmationFormData>;
  editableId?: boolean;
  onSubmitData?: (payload: ConfirmationFormData) => Promise<void> | void;
  onCancel?: () => void;
};
