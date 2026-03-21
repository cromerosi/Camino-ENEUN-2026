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

export type ConfirmationHealthOption = {
  code: ConfirmationHealthConditionCode;
  label: string;
  requiresDetail?: boolean;
  detailField?:
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
  exclusive?: boolean;
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

export type ConfirmationFormData = {
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
  transport: '' | 'SI' | 'PROPIOS_MEDIOS';
  campingConfirmation: '' | 'YES' | 'NO';
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
