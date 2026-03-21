import type {
  ConfirmationBloodType,
  ConfirmationEpsOption,
  ConfirmationHealthOption,
  ConfirmationLodgingOption,
  ConfirmationPronounOption,
  ConfirmationRelationshipOption,
} from "../types/confirmation";

export const confirmationHealthOptions: ConfirmationHealthOption[] = [
  {
    code: "NONE",
    label: "Ninguna",
    exclusive: true,
  },
  {
    code: "ALLERGIES",
    label: "Alergias",
    requiresDetail: true,
    detailField: "allergiesDetail",
  },
  {
    code: "ASTHMA",
    label: "Asma",
    requiresDetail: true,
    detailField: "asthmaDetail",
  },
  {
    code: "CARDIAC",
    label: "Condiciones cardíacas",
    requiresDetail: true,
    detailField: "cardiacConditionsDetail",
  },
  {
    code: "DIABETES",
    label: "Diabetes",
    requiresDetail: true,
    detailField: "diabetesDetail",
  },
  {
    code: "HEARING_DISABILITY",
    label: "Discapacidad auditiva",
    requiresDetail: true,
    detailField: "hearingDisabilityDetail",
  },
  {
    code: "PSYCHOSOCIAL_DISABILITY",
    label: "Discapacidad psicosocial",
    requiresDetail: true,
    detailField: "psychosocialDisabilityDetail",
  },
  {
    code: "VISUAL_DISABILITY",
    label: "Discapacidad visual",
    requiresDetail: true,
    detailField: "visualDisabilityDetail",
  },
  {
    code: "NON_NEUROTYPICAL",
    label: "No neurotipico",
    requiresDetail: true,
    detailField: "nonNeurotypicalDetail",
  },
  {
    code: "EPILEPSY",
    label: "Epilepsia o antecedentes convulsivos",
    requiresDetail: true,
    detailField: "epilepsyDetail",
  },
  {
    code: "HYPERTENSION",
    label: "Hipertensión",
    requiresDetail: true,
    detailField: "hypertensionDetail",
  },
  {
    code: "PERMANENT_MEDICATION",
    label: "Medicación permanente",
    requiresDetail: true,
    detailField: "permanentMedicationDetail",
  },
  {
    code: "REDUCED_MOBILITY",
    label: "Movilidad reducida",
    requiresDetail: true,
    detailField: "reducedMobilityDetail",
  },
  {
    code: "PREFER_NOT_TO_ANSWER",
    label: "Prefiero no responder",
    exclusive: true,
  },
  {
    code: "OTHER",
    label: "Otra",
    requiresDetail: true,
    detailField: "otherHealthConditionDetail",
  },
];

export const confirmationBloodTypes: ConfirmationBloodType[] = [
  { id: "O+", label: "O+" },
  { id: "O-", label: "O-" },
  { id: "A+", label: "A+" },
  { id: "A-", label: "A-" },
  { id: "B+", label: "B+" },
  { id: "B-", label: "B-" },
  { id: "AB+", label: "AB+" },
  { id: "AB-", label: "AB-" },
];

export const confirmationPronounOptions: ConfirmationPronounOption[] = [
  { value: "ella", label: "Ella" },
  { value: "el", label: "Él" },
  { value: "elle", label: "Elle" },
  { value: "otro", label: "Otro" },
];

export const confirmationRelationshipOptions: ConfirmationRelationshipOption[] =
  [
    { value: "madre", label: "Madre" },
    { value: "padre", label: "Padre" },
    { value: "hermano", label: "Hermano/a" },
    { value: "pareja", label: "Pareja" },
    { value: "familiar", label: "Familiar" },
    { value: "amistad", label: "Amigo/a" },
    { value: "otro", label: "Otro" },
  ];

export const confirmationLodgingOptions: ConfirmationLodgingOption[] = [
  {
    value: "Holtel, Hostal, Airbnb, etc...",
    label: "Holtel, Hostal, Airbnb, etc...",
  },
  {
    value: "Casa de familiar o amistad",
    label: "Casa de familiar o amistad",
  },
  { value: "Planea Acampar", label: "Planea Acampar" },
];

export const confirmationEpsOptions: ConfirmationEpsOption[] = [
  { id: "aliansalud_eps_sa", name: "ALIANSALUD EPS S.A." },
  {
    id: "alianza_medellin_antioquia_savia_salud_eps",
    name: 'ALIANZA MEDELLIN ANTIOQUIA EPS S.A.S. "SAVIA SALUD EPS"',
  },
  { id: "anas_wayuu_epsi", name: "ANAS WAYUU EPSI" },
  { id: "asmet_salud_eps_sas", name: "ASMET SALUD EPS S.A.S." },
  {
    id: "asistencia_medica_inmediata_sap_sa",
    name: "ASISTENCIA MEDICA INMEDIATA - SERVICIO DE AMBULANCIA PREPAGADA S.A.",
  },
  {
    id: "asistencia_medica_sas_sap",
    name: "ASISTENCIA MEDICA SAS SERVICIO DE AMBULANCIA PREPAGADO",
  },
  {
    id: "aic_epsi",
    name: "ASOCIACION INDIGENA DEL CAUCA A.I.C. EPSI",
  },
  {
    id: "ambuq_eps_s_ess",
    name: "ASOCIACION MUTUAL BARRIOS UNIDOS DE QUIBDO AMBUQ EPS-S-ESS",
  },
  {
    id: "mutual_ser_eps",
    name: "ASOCIACION MUTUAL SER EPS",
  },
  {
    id: "dusakawi_arsi",
    name: 'ASOCIACION DE CABILDOS INDIGENAS DEL CESAR Y GUAJIRA "DUSAKAWI A.R.S.I."',
  },
  { id: "cajacopi_atlantico", name: "CAJACOPI ATLANTICO" },
  {
    id: "capital_salud_eps_s",
    name: "CAPITAL SALUD EPS-S S.A.S.",
  },
  { id: "capresoca_eps", name: "CAPRESOCA E.P.S." },
  {
    id: "comfamiliar_cartagena_bolivar",
    name: "CAJA DE COMPENSACION FAMILIAR DE CARTAGENA Y BOLIVAR COMFAMILIAR",
  },
  {
    id: "comfacundi",
    name: 'CAJA DE COMPENSACION FAMILIAR DE CUNDINAMARCA "COMFACUNDI"',
  },
  {
    id: "comfaguajira",
    name: 'CAJA DE COMPENSACION FAMILIAR DE LA GUAJIRA "COMFAGUAJIRA"',
  },
  {
    id: "caja_compensacion_familiar_narino",
    name: "CAJA DE COMPENSACION FAMILIAR DE NARINO",
  },
  {
    id: "caja_compensacion_familiar_sucre",
    name: "CAJA DE COMPENSACION FAMILIAR DE SUCRE",
  },
  {
    id: "comfachoco",
    name: "CAJA DE COMPENSACION FAMILIAR DEL CHOCO",
  },
  {
    id: "comfamiliar_huila",
    name: 'CAJA DE COMPENSACION FAMILIAR DEL HUILA "COMFAMILIAR"',
  },
  {
    id: "comfaoriente",
    name: 'CAJA DE COMPENSACION FAMILIAR DEL ORIENTE COLOMBIANO "COMFAORIENTE"',
  },
  {
    id: "comfenalco_valle",
    name: 'CAJA DE COMPENSACION FAMILIAR DEL VALLE DEL CAUCA "COMFENALCO VALLE DE LA GENTE"',
  },
  {
    id: "compensar",
    name: "CAJA DE COMPENSACION FAMILIAR COMPENSAR",
  },
  {
    id: "coomeva_eps",
    name: 'COOMEVA ENTIDAD PROMOTORA DE SALUD S.A. "COOMEVA E.P.S. S.A."',
  },
  {
    id: "coomeva_medicina_prepagada",
    name: "COOMEVA MEDICINA PREPAGADA S.A.",
  },
  {
    id: "coomeva_emergencias_medicas",
    name: "COOMEVA EMERGENCIAS MEDICAS",
  },
  {
    id: "comparta_eps_s",
    name: "COMPARTA EPS-S",
  },
  {
    id: "colmedica_medicina_prepagada",
    name: "COLMEDICA MEDICINA PREPAGADA",
  },
  {
    id: "colpatria_medicina_prepagada",
    name: "COLPATRIA MEDICINA PREPAGADA S.A.",
  },
  {
    id: "colsanitas_medicina_prepagada",
    name: "COMPANIA DE MEDICINA PREPAGADA COLSANITAS S.A.",
  },
  { id: "coosalud_eps", name: "COOSALUD EPS S.A." },
  { id: "cruz_blanca_eps", name: "CRUZ BLANCA EPS" },
  { id: "ecoopsos_eps", name: "ECOOPSOS EPS SAS" },
  {
    id: "emergencia_medica_integral_colombia",
    name: "EMERGENCIA MEDICA INTEGRAL COLOMBIA S.A.",
  },
  {
    id: "emermedica",
    name: "EMERMEDICA S.A. SERVICIOS DE AMBULANCIA PREPAGADOS",
  },
  {
    id: "emi_sap",
    name: "EMPRESA DE MEDICINA INTEGRAL EMI S.A. SERVICIO DE AMBULANCIA PREPAGADA",
  },
  { id: "emssanar", name: "EMSSANAR S.A.S." },
  {
    id: "epm_departamento_medico",
    name: "EMPRESAS PUBLICAS DE MEDELLIN - DEPARTAMENTO MEDICO",
  },
  {
    id: "convida_eps",
    name: "EPS CONVIDA",
  },
  {
    id: "mallamas_epsi",
    name: "ENTIDAD PROMOTORA DE SALUD MALLAMAS EPSI",
  },
  {
    id: "sanitas_eps",
    name: "ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.",
  },
  {
    id: "sos_eps",
    name: "ENTIDAD PROMOTORA DE SALUD SERVICIO OCCIDENTAL DE SALUD S.A. S.O.S.",
  },
  {
    id: "sura_medicina_prepagada",
    name: "EPS Y MEDICINA PREPAGADA SURAMERICANA S.A.",
  },
  { id: "famisanar_eps", name: "EPS FAMISANAR S.A.S." },
  { id: "eps_sura", name: "EPS SURAMERICANA S.A." },
  { id: "ecopetrol", name: "ECOPETROL" },
  {
    id: "ferrocarriles_nacionales_fondo_pasivo_social",
    name: "FONDO PASIVO SOCIAL DE LOS FERROCARRILES NACIONALES",
  },
  { id: "fuerzas_militares", name: "FUERZAS MILITARES" },
  { id: "salud_mia", name: "FUNDACION SALUD MIA" },
  {
    id: "humana_golden_cross",
    name: "HUMANA GOLDEN CROSS S.A. MEDICINA PREPAGADA",
  },
  { id: "magisterio", name: "MAGISTERIO" },
  { id: "medimas_eps", name: "MEDIMAS EPS S.A.S." },
  {
    id: "medisalud_medicina_prepagada",
    name: "MEDISALUD - COMPANIA COLOMBIANA DE MEDICINA PREPAGADA S.A.",
  },
  {
    id: "medisanitas_medicina_prepagada",
    name: "MEDISANITAS S.A. COMPANIA DE MEDICINA PREPAGADA",
  },
  {
    id: "medplus_medicina_prepagada",
    name: "MEDPLUS MEDICINA PREPAGADA S.A.",
  },
  { id: "nueva_eps", name: "NUEVA EPS S.A." },
  { id: "pijaos_salud_epsi", name: "PIJAOS SALUD EPSI" },
  { id: "policia_nacional", name: "POLICIA NACIONAL" },
  {
    id: "plan_uhcm_comfenalco_valle",
    name: "PLAN U.H.C.M. MEDICINA PREPAGADA COMFENALCO VALLE",
  },
  {
    id: "red_medica_vital_sap",
    name: "RED MEDICA MEDICA VITAL S.A.S. SERVICIO DE AMBULANCIA PREPAGADO (SAP)",
  },
  {
    id: "salud_total_eps",
    name: "SALUD TOTAL ENTIDAD PROMOTORA DE SALUD DEL REGIMEN CONTRIBUTIVO Y DEL REGIMEN SUBSIDIADO S.A.",
  },
  {
    id: "servicio_asistencia_medica_inmediata_sap",
    name: "SERVICIO DE ASISTENCIA MEDICA INMEDIATA S.A. - SERVICIO DE AMBULANCIA PREPAGADO",
  },
  {
    id: "servicio_salud_inmediato_medicina_prepagada",
    name: "SERVICIO DE SALUD INMEDIATO MEDICINA PREPAGADA S.A.",
  },
  {
    id: "servicio_emergencias_regional_sap",
    name: "SERVICIO DE EMERGENCIAS REGIONAL S.A. - SERVICIO DE AMBULANCIA PREPAGADO",
  },
  {
    id: "semi_sap",
    name: 'SERVICIOS MEDICOS INTEGRALES DE COLOMBIA SERVICIO DE AMBULANCIAS PREPAGADO S.A.S. "SEMI SAP S.A.S."',
  },
  {
    id: "trasmedica_sap",
    name: "SISTEMA DE TRASLADO APOYO DIAGNOSTICO Y TERAPEUTICO EN SALUD TRASMEDICA S.A. S.A.P.",
  },
  { id: "susalud_eps", name: "SUSALUD EPS" },
  { id: "universidad_atlantico", name: "UNIVERSIDAD DEL ATLANTICO" },
  {
    id: "universidad_industrial_santander",
    name: "UNIVERSIDAD INDUSTRIAL DE SANTANDER",
  },
  { id: "universidad_valle", name: "UNIVERSIDAD DEL VALLE" },
  {
    id: "universidad_nacional_colombia",
    name: "UNIVERSIDAD NACIONAL DE COLOMBIA",
  },
  { id: "universidad_cauca", name: "UNIVERSIDAD DEL CAUCA" },
  { id: "universidad_cartagena", name: "UNIVERSIDAD DE CARTAGENA" },
  { id: "universidad_antioquia", name: "UNIVERSIDAD DE ANTIOQUIA" },
  { id: "universidad_cordoba", name: "UNIVERSIDAD DE CORDOBA" },
  { id: "universidad_narino", name: "UNIVERSIDAD DE NARINO" },
  {
    id: "uptc",
    name: "UNIVERSIDAD PEDAGOGICA Y TECNOLOGICA DE COLOMBIA - UPTC",
  },
  { id: "vivir_sa", name: "VIVIR S.A." },
  { id: "otra", name: "Otra / No aparece en la lista" },
];