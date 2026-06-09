import { useEffect, useRef, useState } from 'react';
import { sensorService } from 'services/sensorService';
import { stationService } from 'services/stationService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise paginated { data: [...] } or plain array responses */
function toArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

// ─── StationSelectField ───────────────────────────────────────────────────────
/**
 * Fetches all stations (max 100 per the backend DTO) on mount and renders a
 * searchable native <select>.  Stores the station UUID as the field value.
 */
export function StationSelectField({ field, value, onChange }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    stationService
      .getStations({ limit: 100 })          // @Max(100) enforced by backend DTO
      .then((res) => setStations(toArray(res)))
      .catch(() => setError('Could not load stations'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <label className="property-field">
        <span>{field.label}</span>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder="Station ID (manual fallback)"
        />
        <small style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{error}</small>
      </label>
    );
  }

  return (
    <label className="property-field">
      <span>{field.label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        disabled={loading}
      >
        <option value="">
          {loading ? 'Loading stations…' : '— Select a station —'}
        </option>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── SensorSelectField ────────────────────────────────────────────────────────
/**
 * Cascades from a station dropdown.
 *
 * - Empty until a station is selected (shows "Select a station first").
 * - Fetches sensors server-side using ?stationId=<uuid>&limit=100 whenever
 *   the station changes — no need to load the full sensor catalogue upfront.
 * - Stores the sensor UUID as the field value.
 *
 * @param {string} stationId  current value of the sibling station field
 */
export function SensorSelectField({ field, value, stationId, onChange }) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Track the stationId that was in effect when the current sensors were fetched
  // so we can clear the selected sensor when the station changes.
  const prevStationRef = useRef(stationId);

  useEffect(() => {
    // Clear the sensor value when the station changes
    if (prevStationRef.current !== stationId && stationId) {
      onChange(field.name, '');
    }
    prevStationRef.current = stationId;

    if (!stationId) {
      setSensors([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Use server-side filtering — SensorQueryDto supports ?stationId (IsUUID)
    sensorService
      .getSensors({ stationId, limit: 100 })
      .then((res) => setSensors(toArray(res)))
      .catch(() => setError('Could not load sensors'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  if (error) {
    return (
      <label className="property-field">
        <span>{field.label}</span>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder="Sensor ID (manual fallback)"
        />
        <small style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{error}</small>
      </label>
    );
  }

  const placeholder = !stationId
    ? '— Select a station first —'
    : loading
    ? 'Loading sensors…'
    : sensors.length === 0
    ? '— No sensors found for this station —'
    : '— Select a sensor —';

  return (
    <label className="property-field">
      <span>{field.label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        disabled={!stationId || loading}
      >
        <option value="">{placeholder}</option>
        {sensors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.type  ? ` · ${s.type}`  : ''}
            {s.unit  ? ` (${s.unit})`  : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
