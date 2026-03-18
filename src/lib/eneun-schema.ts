export type SqlColumnType =
  | 'integer'
  | 'text'
  | 'boolean'
  | 'jsonb'
  | 'timestamp with time zone'
  | 'user';

export interface TableColumnDefinition {
  table: string;
  column: string;
  type: SqlColumnType;
}

export interface ForeignKeyDefinition {
  table: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export const ENEUN_TABLE_COLUMNS: TableColumnDefinition[] = [
  { table: 'base_equipo_organizacion', column: 'email', type: 'text' },
  { table: 'base_equipo_organizacion', column: 'comite', type: 'text' },

  { table: 'admin_campus_scopes', column: 'admin_id', type: 'integer' },
  { table: 'admin_campus_scopes', column: 'campus', type: 'text' },
  { table: 'admin_campus_scopes', column: 'created_at', type: 'timestamp with time zone' },

  { table: 'admins', column: 'id', type: 'integer' },
  { table: 'admins', column: 'username', type: 'text' },
  { table: 'admins', column: 'name', type: 'text' },
  { table: 'admins', column: 'password', type: 'text' },
  { table: 'admins', column: 'is_super', type: 'boolean' },
  { table: 'admins', column: 'created_at', type: 'timestamp with time zone' },
  { table: 'admins', column: 'campus', type: 'text' },
  { table: 'admins', column: 'is_global', type: 'boolean' },
  { table: 'admins', column: 'assigned_campuses', type: 'jsonb' },

  { table: 'campus_phase_states', column: 'campus', type: 'text' },
  { table: 'campus_phase_states', column: 'phase', type: 'text' },
  { table: 'campus_phase_states', column: 'active', type: 'boolean' },
  { table: 'campus_phase_states', column: 'updated_at', type: 'timestamp with time zone' },

  { table: 'confirmation_amazonia', column: 'id', type: 'integer' },
  { table: 'confirmation_amazonia', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_amazonia', column: 'email', type: 'text' },
  { table: 'confirmation_amazonia', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_amazonia', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_amazonia', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_answers', column: 'id', type: 'integer' },
  { table: 'confirmation_answers', column: 'submission_id', type: 'integer' },
  { table: 'confirmation_answers', column: 'question_key', type: 'text' },
  { table: 'confirmation_answers', column: 'value', type: 'jsonb' },

  { table: 'confirmation_bogota', column: 'id', type: 'integer' },
  { table: 'confirmation_bogota', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_bogota', column: 'email', type: 'text' },
  { table: 'confirmation_bogota', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_bogota', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_bogota', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_caribe', column: 'id', type: 'integer' },
  { table: 'confirmation_caribe', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_caribe', column: 'email', type: 'text' },
  { table: 'confirmation_caribe', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_caribe', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_caribe', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_la_paz', column: 'id', type: 'integer' },
  { table: 'confirmation_la_paz', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_la_paz', column: 'email', type: 'text' },
  { table: 'confirmation_la_paz', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_la_paz', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_la_paz', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_manizales', column: 'id', type: 'integer' },
  { table: 'confirmation_manizales', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_manizales', column: 'email', type: 'text' },
  { table: 'confirmation_manizales', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_manizales', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_manizales', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_medellin', column: 'id', type: 'integer' },
  { table: 'confirmation_medellin', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_medellin', column: 'email', type: 'text' },
  { table: 'confirmation_medellin', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_medellin', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_medellin', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_orinoquia', column: 'id', type: 'integer' },
  { table: 'confirmation_orinoquia', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_orinoquia', column: 'email', type: 'text' },
  { table: 'confirmation_orinoquia', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_orinoquia', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_orinoquia', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_palmira', column: 'id', type: 'integer' },
  { table: 'confirmation_palmira', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_palmira', column: 'email', type: 'text' },
  { table: 'confirmation_palmira', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_palmira', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_palmira', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_submissions', column: 'id', type: 'integer' },
  { table: 'confirmation_submissions', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_submissions', column: 'campus', type: 'text' },
  { table: 'confirmation_submissions', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_submissions', column: 'will_attend', type: 'boolean' },

  { table: 'confirmation_tumaco', column: 'id', type: 'integer' },
  { table: 'confirmation_tumaco', column: 'registration_id', type: 'integer' },
  { table: 'confirmation_tumaco', column: 'email', type: 'text' },
  { table: 'confirmation_tumaco', column: 'answers', type: 'jsonb' },
  { table: 'confirmation_tumaco', column: 'submitted_at', type: 'timestamp with time zone' },
  { table: 'confirmation_tumaco', column: 'will_attend', type: 'boolean' },

  { table: 'form_closure_exemptions', column: 'email', type: 'text' },
  { table: 'form_closure_exemptions', column: 'created_at', type: 'timestamp with time zone' },

  { table: 'form_config', column: 'id', type: 'integer' },
  { table: 'form_config', column: 'is_closed', type: 'boolean' },
  { table: 'form_config', column: 'closed_message', type: 'text' },
  { table: 'form_config', column: 'updated_at', type: 'timestamp with time zone' },
  { table: 'form_config', column: 'open_email_mode', type: 'boolean' },
  { table: 'form_config', column: 'late_window_hours', type: 'integer' },
  { table: 'form_config', column: 'late_window_started_at', type: 'timestamp with time zone' },

  { table: 'form_states', column: 'phase', type: 'text' },
  { table: 'form_states', column: 'active', type: 'boolean' },
  { table: 'form_states', column: 'updated_at', type: 'timestamp with time zone' },

  { table: 'questions', column: 'id', type: 'integer' },
  { table: 'questions', column: 'key', type: 'text' },
  { table: 'questions', column: 'question', type: 'text' },
  { table: 'questions', column: 'type', type: 'text' },
  { table: 'questions', column: 'required', type: 'boolean' },
  { table: 'questions', column: 'options', type: 'jsonb' },
  { table: 'questions', column: 'constraints', type: 'jsonb' },
  { table: 'questions', column: 'extra', type: 'jsonb' },
  { table: 'questions', column: 'created_at', type: 'timestamp with time zone' },
  { table: 'questions', column: 'phase', type: 'text' },
  { table: 'questions', column: 'campus', type: 'text' },

  { table: 'registrations', column: 'id', type: 'integer' },
  { table: 'registrations', column: 'first_name', type: 'text' },
  { table: 'registrations', column: 'last_name', type: 'text' },
  { table: 'registrations', column: 'email', type: 'text' },
  { table: 'registrations', column: 'phone', type: 'text' },
  { table: 'registrations', column: 'university', type: 'text' },
  { table: 'registrations', column: 'career', type: 'text' },
  { table: 'registrations', column: 'semester', type: 'text' },
  { table: 'registrations', column: 'ticket_type', type: 'text' },
  { table: 'registrations', column: 'document_type', type: 'text' },
  { table: 'registrations', column: 'document_number', type: 'text' },
  { table: 'registrations', column: 'whatsapp', type: 'text' },
  { table: 'registrations', column: 'answers', type: 'jsonb' },
  { table: 'registrations', column: 'registered_at', type: 'timestamp with time zone' },
  { table: 'registrations', column: 'uuid', type: 'text' },
  { table: 'registrations', column: 'faculty', type: 'text' },
  { table: 'registrations', column: 'has_disability', type: 'text' },
  { table: 'registrations', column: 'disability_specify', type: 'text' },
  { table: 'registrations', column: 'requires_adjustment', type: 'text' },
  { table: 'registrations', column: 'adjustment_specify', type: 'text' },
  { table: 'registrations', column: 'dietary_preference', type: 'text' },
  { table: 'registrations', column: 'dietary_other', type: 'text' },
  { table: 'registrations', column: 'allergies', type: 'text' },
  { table: 'registrations', column: 'allergy_specify', type: 'text' },
  { table: 'registrations', column: 'allow_whatsapp', type: 'text' },
  { table: 'registrations', column: 'suggestion', type: 'text' },
  { table: 'registrations', column: 'is_representative', type: 'text' },
  { table: 'registrations', column: 'representative_bodies', type: 'jsonb' },
  { table: 'registrations', column: 'cuerpo_colegiado', type: 'text' },
  { table: 'registrations', column: 'confirm_answers', type: 'jsonb' },
  { table: 'registrations', column: 'confirm_submitted_at', type: 'timestamp with time zone' },
  { table: 'registrations', column: 'attendance_days', type: 'jsonb' },
  { table: 'registrations', column: 'final_submitted_at', type: 'timestamp with time zone' },
  { table: 'registrations', column: 'is_late', type: 'boolean' },
  { table: 'registrations', column: 'late_marked_at', type: 'timestamp with time zone' },
] as const;

export const ENEUN_FOREIGN_KEYS: ForeignKeyDefinition[] = [
  { table: 'session', column: 'userId', referencesTable: 'user', referencesColumn: 'id' },
  { table: 'account', column: 'userId', referencesTable: 'user', referencesColumn: 'id' },
  { table: 'member', column: 'organizationId', referencesTable: 'organization', referencesColumn: 'id' },
  { table: 'member', column: 'userId', referencesTable: 'user', referencesColumn: 'id' },
  { table: 'invitation', column: 'organizationId', referencesTable: 'organization', referencesColumn: 'id' },
  { table: 'invitation', column: 'inviterId', referencesTable: 'user', referencesColumn: 'id' },
  { table: 'admin_campus_scopes', column: 'admin_id', referencesTable: 'admins', referencesColumn: 'id' },
  { table: 'confirmation_bogota', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_medellin', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_manizales', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_palmira', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_la_paz', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_tumaco', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_amazonia', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_orinoquia', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_caribe', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_submissions', column: 'registration_id', referencesTable: 'registrations', referencesColumn: 'id' },
  { table: 'confirmation_answers', column: 'submission_id', referencesTable: 'confirmation_submissions', referencesColumn: 'id' },
] as const;

export const ENEUN_CAMPUS_CONFIRMATION_TABLES = {
  bogota: 'confirmation_bogota',
  medellin: 'confirmation_medellin',
  manizales: 'confirmation_manizales',
  palmira: 'confirmation_palmira',
  la_paz: 'confirmation_la_paz',
  tumaco: 'confirmation_tumaco',
  amazonia: 'confirmation_amazonia',
  orinoquia: 'confirmation_orinoquia',
  caribe: 'confirmation_caribe',
} as const;

export const ENEUN_PROCESS_NODES = [
  'Preinscripcion',
  'Preconfirmacion',
  'Validacion de sede de origen',
  'Capacitaciones de la plataforma',
  'Formulario final',
] as const;

export const ENEUN_NODE_STATUSES = ['gray', 'green', 'purple', 'red'] as const;

export type EneunProcessNode = (typeof ENEUN_PROCESS_NODES)[number];
export type EneunConfirmationCampus = keyof typeof ENEUN_CAMPUS_CONFIRMATION_TABLES;
export type EneunNodeStatus = (typeof ENEUN_NODE_STATUSES)[number];

export interface EneunJourneyStepState {
  label: EneunProcessNode;
  status: EneunNodeStatus;
  detail: string;
}

const ENEUN_DEFAULT_STEP_STATUS_BY_NODE: Record<EneunProcessNode, EneunNodeStatus> = {
  Preinscripcion: 'green',
  Preconfirmacion: 'green',
  'Validacion de sede de origen': 'purple',
  'Capacitaciones de la plataforma': 'red',
  'Formulario final': 'gray',
};

const ENEUN_DEFAULT_STEP_DETAIL_BY_NODE: Record<EneunProcessNode, string> = {
  Preinscripcion: 'Completado el 04·03',
  Preconfirmacion: 'Confirmado el 08·03',
  'Validacion de sede de origen': 'En verificacion',
  'Capacitaciones de la plataforma': 'Sesion reprogramada',
  'Formulario final': 'Sin abrir',
};

export const ENEUN_DEFAULT_JOURNEY_STEPS: EneunJourneyStepState[] = ENEUN_PROCESS_NODES.map(
  (node) => ({
    label: node,
    status: ENEUN_DEFAULT_STEP_STATUS_BY_NODE[node],
    detail: ENEUN_DEFAULT_STEP_DETAIL_BY_NODE[node],
  }),
);
