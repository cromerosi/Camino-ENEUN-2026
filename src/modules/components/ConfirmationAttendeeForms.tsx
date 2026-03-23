import { useEffect, useMemo, useState } from 'react';
import type {
  ConfirmationFormData,
  ConfirmationFormProps,
  ConfirmationHealthConditionCode,
} from '../types/confirmation';

import {
  confirmationBloodTypes,
  confirmationHealthOptions,
  confirmationLodgingOptions,
  confirmationPronounOptions,
  confirmationRelationshipOptions,
} from '../constants/confirmationCatalogs';

import {
  clearUnusedHealthDetailFields,
  createConfirmationInitialData,
  normalizeHealthSelection,
  validateConfirmationForm,
} from '../utils/confirmationFormUtils';

import { ConfirmationSection } from './ConfirmationSection';
import { ConfirmationTextInput } from './ConfirmationTextInput';
import { ConfirmationTextarea } from './ConfirmationTextarea';
import { ConfirmationSelect } from './ConfirmationSelect';
import { ConfirmationCheckboxCard } from './ConfirmationCheckboxCard';
import { ConfirmationFieldError } from './ConfirmationFieldError';

const BADGE_NAME_RECOMMENDED_MAX_LENGTH = 18;

export function ConfirmationAttendeeForm({
  prefill,
  initialData,
  editableId = true,
  onSubmitData,
  onCancel,
}: ConfirmationFormProps) {
  const [form, setForm] = useState<ConfirmationFormData>(() =>
    createConfirmationInitialData(prefill, initialData)
  );

  const [errors, setErrors] = useState<
    Partial<Record<keyof ConfirmationFormData, string>>
  >({});
  const [submitError, setSubmitError] = useState<string>('');
  const [submitValidationMessage, setSubmitValidationMessage] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(createConfirmationInitialData(prefill, initialData));
    setErrors({});
    setSubmitError('');
    setSubmitValidationMessage('');
  }, [prefill, initialData]);

  const selectedHealthOptions = useMemo(
    () =>
      confirmationHealthOptions.filter((option) =>
        form.healthConditionCodes.includes(option.code)
      ),
    [form.healthConditionCodes]
  );

  const healthSummary = useMemo(() => {
    if (form.healthConditionCodes.includes('PREFER_NOT_TO_ANSWER')) {
      return 'Prefiere no responder';
    }

    if (form.healthConditionCodes.includes('NONE')) {
      return 'Sin condiciones reportadas';
    }

    return selectedHealthOptions.map((item) => item.label).join(', ') || 'Sin condiciones reportadas';
  }, [form.healthConditionCodes, selectedHealthOptions]);

  const pronounSummary = useMemo(() => {
    if (!form.pronoun) {
      return 'Sin seleccionar';
    }

    if (form.pronoun === 'otro') {
      return form.pronounOther.trim() || 'Otro (sin especificar)';
    }

    const option = confirmationPronounOptions.find((item) => item.value === form.pronoun);
    return option?.label ?? form.pronoun;
  }, [form.pronoun, form.pronounOther]);

  const transportSummary = useMemo(() => {
    if (form.transport === 'SI') {
      return 'Usará transporte suministrado por la universidad';
    }

    if (form.transport === 'PROPIOS_MEDIOS') {
      return 'Se movilizará por medios propios';
    }

    return 'Sin seleccionar';
  }, [form.transport]);

  const emergencySummary = useMemo(() => {
    const name = form.emergencyContactName.trim();
    const relationship = form.emergencyContactRelationship.trim();
    const phone = form.emergencyContactPhone.trim();

    if (!name && !phone) {
      return 'Sin completar';
    }

    const relationshipText = relationship ? ` (${relationship})` : '';
    const phoneText = phone ? ` - ${phone}` : '';
    return `${name || 'Sin nombre'}${relationshipText}${phoneText}`;
  }, [form.emergencyContactName, form.emergencyContactPhone, form.emergencyContactRelationship]);

  const lodgingAddressSummary = useMemo(() => {
    if (!form.lodgingChoice) {
      return 'Sin seleccionar';
    }

    if (form.lodgingChoice === 'Planea Acampar') {
      return 'UNAL, Campus La Nubia';
    }

    return form.lodgingAddress.trim() || 'No registrada';
  }, [form.lodgingAddress, form.lodgingChoice]);

  const badgeNameWarning = useMemo(() => {
    const trimmedBadgeName = form.badgeName.trim();
    if (!trimmedBadgeName) {
      return '';
    }

    const nameParts = trimmedBadgeName.split(/\s+/).filter(Boolean);
    const hasTwoOrMoreNames = nameParts.length >= 2;
    const hasTooManyCharacters = trimmedBadgeName.length > BADGE_NAME_RECOMMENDED_MAX_LENGTH;

    if (!hasTwoOrMoreNames && !hasTooManyCharacters) {
      return '';
    }

    return 'El equipo de T.I (Tecnologia, e Informacion - ENEUN 2026) te recomienda cambiar este nombre por uno mas corto para la escarapela.';
  }, [form.badgeName]);

  function updateField<K extends keyof ConfirmationFormData>(
    key: K,
    value: ConfirmationFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitValidationMessage('');
  }

  function handleToggleHealthCondition(code: ConfirmationHealthConditionCode) {
    setForm((prev) => {
      const nextCodes = normalizeHealthSelection(prev.healthConditionCodes, code);

      return clearUnusedHealthDetailFields({
        ...prev,
        healthConditionCodes: nextCodes,
      });
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitValidationMessage('');

    const cleanedForm = clearUnusedHealthDetailFields({
      ...form,
      id: form.id.trim(),
      badgeName: form.badgeName.trim(),
      sede: form.sede.trim(),
      pronounOther: form.pronounOther.trim(),
      allergiesDetail: form.allergiesDetail.trim(),
      asthmaDetail: form.asthmaDetail.trim(),
      diabetesDetail: form.diabetesDetail.trim(),
      nonNeurotypicalDetail: form.nonNeurotypicalDetail.trim(),
      epilepsyDetail: form.epilepsyDetail.trim(),
      hypertensionDetail: form.hypertensionDetail.trim(),
      cardiacConditionsDetail: form.cardiacConditionsDetail.trim(),
      reducedMobilityDetail: form.reducedMobilityDetail.trim(),
      visualDisabilityDetail: form.visualDisabilityDetail.trim(),
      hearingDisabilityDetail: form.hearingDisabilityDetail.trim(),
      permanentMedicationDetail: form.permanentMedicationDetail.trim(),
      psychosocialDisabilityDetail: form.psychosocialDisabilityDetail.trim(),
      otherHealthConditionDetail: form.otherHealthConditionDetail.trim(),
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactRelationship: form.emergencyContactRelationship.trim(),
      emergencyContactPhone: form.emergencyContactPhone.trim(),
      lodgingAddress: form.lodgingAddress.trim(),
      transport: form.transport,
    });

    const nextErrors = validateConfirmationForm(cleanedForm);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitValidationMessage('Hay campos obligatorios pendientes. Revísalos antes de enviar.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitData?.(cleanedForm);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la información. Inténtalo de nuevo.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ConfirmationSection
        title="Identificación"
        subtitle="Información base y nombre que aparecerá en la escarapela."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <ConfirmationTextInput
            label="Cédula"
            value={form.id}
            onChange={(value) => updateField('id', value)}
            required
            disabled={!editableId}
            error={errors.id}
            placeholder="Ej. 1020304050"
          />

          <ConfirmationTextInput
            label="Sede"
            value={form.sede}
            onChange={(value) => updateField('sede', value)}
            disabled
          />

          <ConfirmationTextInput
            label="UUID"
            value={prefill?.uuid ?? 'No disponible'}
            onChange={() => undefined}
            disabled
          />

          <ConfirmationTextInput
            label="Email"
            value={prefill?.email ?? ''}
            onChange={() => undefined}
            disabled
          />
        </div>

        <ConfirmationTextInput
          label="¿Qué nombre quieres que aparezca en tu escarapela?"
          value={form.badgeName}
          onChange={(value) => updateField('badgeName', value)}
          required
          error={errors.badgeName}
          placeholder="Escribe el nombre con el que te sientes cómodx"
        />
        <p className="-mt-2 text-xs text-slate-300">
          Este nombre es el que verá la gente en tu escarapela. Escribe el nombre con el que te sientes cómodx y evita poner nuevamente tu nombre completo.
        </p>
        {badgeNameWarning && (
          <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            {badgeNameWarning}
          </div>
        )}

        <ConfirmationTextInput
          label="Nombre legal (no editable)"
          value={prefill?.legalName ?? ''}
          onChange={() => undefined}
          disabled
        />
      </ConfirmationSection>

      <ConfirmationSection
        title="Salud y bienestar"
        subtitle="Selecciona las condiciones que quieras reportar. Puedes marcar varias."
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            ¿Hay alguna condición de salud que quieras informarnos para tenerla
            en cuenta durante la actividad?
            <span className="ml-1 text-amber-300">*</span>
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {confirmationHealthOptions.map((option) => (
              <ConfirmationCheckboxCard
                key={option.code}
                checked={form.healthConditionCodes.includes(option.code)}
                label={option.label}
                onToggle={() => handleToggleHealthCondition(option.code)}
              />
            ))}
          </div>
        </div>

        {form.healthConditionCodes.includes('ALLERGIES') && (
          <ConfirmationTextarea
            label="Si seleccionaste alergias, indícanos cuáles debemos tener en cuenta"
            value={form.allergiesDetail}
            onChange={(value) => updateField('allergiesDetail', value)}
            required
            error={errors.allergiesDetail}
            placeholder="Ej. Penicilina, frutos secos, picaduras, etc."
          />
        )}

        {form.healthConditionCodes.includes('ASTHMA') && (
          <ConfirmationTextarea
            label="Si seleccionaste asma, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.asthmaDetail}
            onChange={(value) => updateField('asthmaDetail', value)}
            required
            error={errors.asthmaDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('DIABETES') && (
          <ConfirmationTextarea
            label="Si seleccionaste diabetes, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.diabetesDetail}
            onChange={(value) => updateField('diabetesDetail', value)}
            required
            error={errors.diabetesDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('NON_NEUROTYPICAL') && (
          <ConfirmationTextarea
            label="Si seleccionaste no neurotipico, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.nonNeurotypicalDetail}
            onChange={(value) => updateField('nonNeurotypicalDetail', value)}
            required
            error={errors.nonNeurotypicalDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('EPILEPSY') && (
          <ConfirmationTextarea
            label="Si seleccionaste epilepsia o antecedentes convulsivos, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.epilepsyDetail}
            onChange={(value) => updateField('epilepsyDetail', value)}
            required
            error={errors.epilepsyDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('HYPERTENSION') && (
          <ConfirmationTextarea
            label="Si seleccionaste hipertensión, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.hypertensionDetail}
            onChange={(value) => updateField('hypertensionDetail', value)}
            required
            error={errors.hypertensionDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('CARDIAC') && (
          <ConfirmationTextarea
            label="Si seleccionaste condiciones cardíacas, ¿cuáles deseas reportar?"
            value={form.cardiacConditionsDetail}
            onChange={(value) => updateField('cardiacConditionsDetail', value)}
            required
            error={errors.cardiacConditionsDetail}
            placeholder="Describe brevemente la condición o indicaciones relevantes"
          />
        )}

        {form.healthConditionCodes.includes('REDUCED_MOBILITY') && (
          <ConfirmationTextarea
            label="Si seleccionaste movilidad reducida, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.reducedMobilityDetail}
            onChange={(value) => updateField('reducedMobilityDetail', value)}
            required
            error={errors.reducedMobilityDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('VISUAL_DISABILITY') && (
          <ConfirmationTextarea
            label="Si seleccionaste discapacidad visual, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.visualDisabilityDetail}
            onChange={(value) => updateField('visualDisabilityDetail', value)}
            required
            error={errors.visualDisabilityDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('HEARING_DISABILITY') && (
          <ConfirmationTextarea
            label="Si seleccionaste discapacidad auditiva, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.hearingDisabilityDetail}
            onChange={(value) => updateField('hearingDisabilityDetail', value)}
            required
            error={errors.hearingDisabilityDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('PERMANENT_MEDICATION') && (
          <ConfirmationTextarea
            label="Si seleccionaste medicación permanente, indícanos cuál medicamento tomas y para qué"
            value={form.permanentMedicationDetail}
            onChange={(value) =>
              updateField('permanentMedicationDetail', value)
            }
            required
            error={errors.permanentMedicationDetail}
            placeholder="Ej. Losartán 50 mg para hipertensión"
          />
        )}

        {form.healthConditionCodes.includes('PSYCHOSOCIAL_DISABILITY') && (
          <ConfirmationTextarea
            label="Si seleccionaste discapacidad psicosocial, ¿qué ajuste o consideración debemos tener en cuenta?"
            value={form.psychosocialDisabilityDetail}
            onChange={(value) => updateField('psychosocialDisabilityDetail', value)}
            required
            error={errors.psychosocialDisabilityDetail}
            placeholder="Describe brevemente la información que quieras compartir"
          />
        )}

        {form.healthConditionCodes.includes('OTHER') && (
          <ConfirmationTextarea
            label="Indica cuál otra condición deseas reportar"
            value={form.otherHealthConditionDetail}
            onChange={(value) =>
              updateField('otherHealthConditionDetail', value)
            }
            required
            error={errors.otherHealthConditionDetail}
            placeholder="Escribe aquí la condición"
          />
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <ConfirmationSelect
            label="¿Con qué pronombres te identificas?"
            value={form.pronoun}
            onChange={(value) => {
              updateField('pronoun', value);
              if (value !== 'otro') {
                updateField('pronounOther', '');
              }
            }}
            options={confirmationPronounOptions}
            required
            error={errors.pronoun}
          />

          <ConfirmationSelect
            label="¿Cuál es tu tipo de sangre (RH)?"
            value={form.bloodTypeId}
            onChange={(value) => updateField('bloodTypeId', value)}
            options={confirmationBloodTypes.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            placeholder="Selecciona tu RH"
          />
        </div>

        {form.pronoun === 'otro' && (
          <ConfirmationTextInput
            label="¿Cuál pronombre debemos usar?"
            value={form.pronounOther}
            onChange={(value) => updateField('pronounOther', value)}
            required
            error={errors.pronounOther}
            placeholder="Escribe el pronombre"
          />
        )}

        <ConfirmationTextInput
          label="¿Cuál es tu EPS actual?"
          value={form.epsId}
          onChange={(value) => updateField('epsId', value)}
          required
          error={errors.epsId}
          placeholder="Escribe el nombre de tu EPS"
        />

        <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-100">
          Esta información puede considerarse sensible. Antes de enviar, debes
          autorizar su tratamiento para fines logísticos y de cuidado durante la
          actividad.
        </div>

        <div>
          <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-slate-900/45 p-4">
            <input
              type="checkbox"
              checked={form.consentHealthData}
              onChange={(e) =>
                updateField('consentHealthData', e.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-fuchsia-400"
            />
            <span className="text-sm text-slate-200">
              Autorizo el tratamiento de esta información para la gestión del
              evento y la atención en caso de ser necesaria.
            </span>
          </label>
          <ConfirmationFieldError message={errors.consentHealthData} />
        </div>
      </ConfirmationSection>

      <ConfirmationSection
        title="Contacto de emergencia"
        subtitle="Persona a quien se puede contactar en caso de emergencia."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <ConfirmationTextInput
            label="Nombre del contacto de emergencia"
            value={form.emergencyContactName}
            onChange={(value) => updateField('emergencyContactName', value)}
            required
            error={errors.emergencyContactName}
          />

          <ConfirmationSelect
            label="Parentesco o relación"
            value={form.emergencyContactRelationship}
            onChange={(value) =>
              updateField('emergencyContactRelationship', value)
            }
            options={confirmationRelationshipOptions}
            required
            error={errors.emergencyContactRelationship}
          />
        </div>

        <ConfirmationTextInput
          label="Número de celular del contacto de emergencia"
          value={form.emergencyContactPhone}
          onChange={(value) => updateField('emergencyContactPhone', value)}
          required
          error={errors.emergencyContactPhone}
          placeholder="Ej. 3001234567"
        />
      </ConfirmationSection>

      <ConfirmationSection
        title="Hospedaje"
        subtitle="Cuéntanos cómo planeas movilizarte durante el evento para apoyar la logística de reconfirmación."
      >
        <ConfirmationSelect
          label="Hospedaje registrado previamente"
          value={form.lodgingChoice}
          onChange={(value) => {
            updateField('lodgingChoice', value);
            if (value === 'Planea Acampar') {
              updateField('lodgingAddress', 'UNAL, Campus La Nubia');
            }
          }}
          options={confirmationLodgingOptions}
          required
          error={errors.lodgingChoice}
        />

        {form.lodgingChoice !== '' && form.lodgingChoice !== 'Planea Acampar' && (
          <ConfirmationTextInput
            label="Dirección del alojamiento (opcional, pero recomendada en caso de emergencia)"
            value={form.lodgingAddress}
            onChange={(value) => updateField('lodgingAddress', value)}
            placeholder="Ej. Calle 45 # 12-34, Barrio Centro"
          />
        )}

        {form.lodgingChoice === 'Planea Acampar' && (
          <ConfirmationTextInput
            label="Dirección del alojamiento"
            value="UNAL, Campus La Nubia"
            onChange={() => undefined}
            disabled
          />
        )}
      </ConfirmationSection>

      <ConfirmationSection
        title="Transporte"
        subtitle="Información independiente para la logística de movilidad."
      >
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Confirma y se compromete a hacer uso responsable del transporte, recursos y/o medios suministrados por la universidad, según la logística definida para el evento.
        </div>

        <ConfirmationSelect
          label="Transporte"
          value={form.transport}
          onChange={(value) =>
            updateField('transport', value as '' | 'SI' | 'PROPIOS_MEDIOS')
          }
          options={[
            {
              value: 'SI',
              label:
                'Sí, me comprometo a hacer uso responsable del transporte, recursos y/o medios suministrados por la universidad',
            },
            {
              value: 'PROPIOS_MEDIOS',
              label:
                'No, me comprometo a movilizarme por medio de mis propios recursos',
            },
          ]}
          required
          error={errors.transport}
          placeholder="Selecciona una opción"
        />
      </ConfirmationSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-white/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/35 hover:text-white"
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-[#1f2b5b] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      {submitError && (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 p-4 text-sm text-rose-100">
          {submitError}
        </div>
      )}

      {submitValidationMessage && (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-500/15 p-4 text-sm text-amber-100">
          {submitValidationMessage}
        </div>
      )}

      <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-5 text-sm text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
            Resumen antes de enviar
          </span>
          <span className="rounded-full border border-fuchsia-200/30 bg-fuchsia-400/10 px-3 py-1 text-[11px] text-fuchsia-100">
            Verifica tus datos
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Identificación</p>
            <p className="mt-2 text-slate-100"><span className="text-slate-400">Documento:</span> {form.id.trim() || 'Sin definir'}</p>
            <p className="mt-1 text-slate-100"><span className="text-slate-400">Escarapela:</span> {form.badgeName.trim() || 'Sin definir'}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Salud</p>
            <p className="mt-2 text-slate-100"><span className="text-slate-400">Pronombre:</span> {pronounSummary}</p>
            <p className="mt-1 text-slate-100"><span className="text-slate-400">EPS:</span> {form.epsId.trim() || 'Sin definir'}</p>
            <p className="mt-1 text-slate-100"><span className="text-slate-400">Condiciones:</span> {healthSummary}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Emergencia</p>
            <p className="mt-2 text-slate-100">{emergencySummary}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Logística</p>
            <p className="mt-2 text-slate-100"><span className="text-slate-400">Hospedaje:</span> {form.lodgingChoice || 'Sin seleccionar'}</p>
            <p className="mt-1 text-slate-100"><span className="text-slate-400">Dirección:</span> {lodgingAddressSummary}</p>
            <p className="mt-1 text-slate-100"><span className="text-slate-400">Transporte:</span> {transportSummary}</p>
          </div>
        </div>
      </div>
    </form>
  );
}
