import { SensorSelectField, StationSelectField } from './SmartSelectField';

/**
 * PropertyField
 *
 * Renders a single node-property editor.  Supports:
 *   text / number / textarea / select  — static, no API calls
 *   station-select                     — async station dropdown (SmartSelectField)
 *   sensor-select                      — async sensor dropdown, cascaded from a
 *                                        sibling station field (SmartSelectField)
 *
 * @param {object} field       - field definition from blocks.js
 * @param {*}      value       - current field value
 * @param {object} allValues   - all current property values (needed for sensor-select
 *                               to read the sibling station field)
 * @param {Function} onChange  - (fieldName, newValue) => void
 */
export default function PropertyField({ field, value, allValues, onChange }) {
  // ── Smart async dropdowns ──────────────────────────────────────────────────

  if (field.type === 'station-select') {
    return (
      <StationSelectField
        field={field}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'sensor-select') {
    // Read the sibling station field value so we can filter sensors
    const stationId = allValues?.[field.stationField] || '';
    return (
      <SensorSelectField
        field={field}
        value={value}
        stationId={stationId}
        onChange={onChange}
      />
    );
  }

  // ── Static fields ──────────────────────────────────────────────────────────

  const commonProps = {
    id: field.name,
    name: field.name,
    value: value ?? '',
    onChange: (event) =>
      onChange(
        field.name,
        field.type === 'number' ? Number(event.target.value) : event.target.value,
      ),
  };

  return (
    <label className="property-field">
      <span>{field.label}</span>
      {field.type === 'select' ? (
        <select {...commonProps}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea {...commonProps} rows={4} />
      ) : field.type === 'datetime-local' ? (
        <input {...commonProps} type="datetime-local" />
      ) : (
        <input {...commonProps} type={field.type || 'text'} />
      )}
    </label>
  );
}
