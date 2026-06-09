import { useEffect, useState } from 'react';
import {
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
} from 'reactstrap';
import { sensorService } from '../../services/sensorService';

// ─── Cron Presets ─────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: 'Every minute',   value: '* * * * *' },
  { label: 'Every 5 min',   value: '*/5 * * * *' },
  { label: 'Every 15 min',  value: '*/15 * * * *' },
  { label: 'Every 30 min',  value: '*/30 * * * *' },
  { label: 'Every hour',    value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every day (midnight)', value: '0 0 * * *' },
  { label: 'Custom…',       value: '__custom__' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultForm() {
  return {
    name: '',
    triggerType: 'manual',
    isActive: false,
    // scheduled
    cronPreset: '0 * * * *',
    cronCustom: '',
    // sensor_threshold
    sensorId: '',
    condition: 'above',
    threshold: '',
  };
}

function formToCronValue(form) {
  if (form.cronPreset === '__custom__') return form.cronCustom.trim();
  return form.cronPreset;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * WorkflowSettingsModal
 *
 * Props:
 *   isOpen      {boolean}
 *   onClose     {() => void}
 *   onSave      {(settings: { name, triggerType, triggerConfig, isActive }) => void}
 *   initial     {object} — current workflow settings (populated from last save)
 */
export default function WorkflowSettingsModal({ isOpen, onClose, onSave, initial = {} }) {
  const [form, setForm] = useState(defaultForm());
  const [sensors, setSensors] = useState([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);

  // Populate form when modal opens with existing settings
  useEffect(() => {
    if (!isOpen) return;

    const triggerType = initial.triggerType || 'manual';
    const config = initial.triggerConfig || {};

    // Determine cron preset vs custom
    const savedCron = config.cron || '0 * * * *';
    const matchedPreset = CRON_PRESETS.find(
      (p) => p.value !== '__custom__' && p.value === savedCron,
    );

    setForm({
      name: initial.name || '',
      triggerType,
      isActive: initial.isActive || false,
      cronPreset: matchedPreset ? savedCron : '__custom__',
      cronCustom: matchedPreset ? '' : savedCron,
      sensorId: config.sensorId || '',
      condition: config.condition || 'above',
      threshold: config.threshold != null ? String(config.threshold) : '',
    });
  }, [isOpen, initial]);

  // Fetch sensor list when sensor_threshold is selected
  useEffect(() => {
    if (!isOpen || form.triggerType !== 'sensor_threshold') return;
    setSensorsLoading(true);
    sensorService
      .getSensors({ limit: 200 })
      .then((res) => setSensors(res.data || []))
      .catch(() => setSensors([]))
      .finally(() => setSensorsLoading(false));
  }, [isOpen, form.triggerType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let triggerConfig = {};

    if (form.triggerType === 'scheduled') {
      const cron = formToCronValue(form);
      if (!cron) return; // don't save with empty cron
      triggerConfig = { cron };
    } else if (form.triggerType === 'sensor_threshold') {
      if (!form.sensorId) return; // sensor required
      triggerConfig = {
        sensorId: form.sensorId,
        condition: form.condition,
        threshold: form.threshold !== '' ? Number(form.threshold) : 0,
      };
    }

    onSave({
      name: form.name || undefined,
      triggerType: form.triggerType,
      triggerConfig,
      isActive: form.isActive,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg">
      <Form onSubmit={handleSubmit}>
        <ModalHeader toggle={onClose}>
          <i className="ni ni-settings mr-2" />
          Workflow Settings
        </ModalHeader>

        <ModalBody>
          {/* Workflow Name */}
          <FormGroup>
            <Label>Workflow Name</Label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Pump Pressure Guard"
            />
          </FormGroup>

          <hr className="my-3" />

          {/* Trigger Type */}
          <FormGroup>
            <Label className="font-weight-bold">Trigger Type</Label>
            <Input
              type="select"
              name="triggerType"
              value={form.triggerType}
              onChange={handleChange}
            >
              <option value="manual">Manual — run on demand only</option>
              <option value="scheduled">Scheduled — run on a cron schedule</option>
              <option value="sensor_threshold">Sensor Threshold — run when a sensor value crosses a threshold</option>
            </Input>
          </FormGroup>

          {/* ── Scheduled: cron config ──────────────────────────────────── */}
          {form.triggerType === 'scheduled' && (
            <>
              <FormGroup>
                <Label>Schedule Preset</Label>
                <Input
                  type="select"
                  name="cronPreset"
                  value={form.cronPreset}
                  onChange={handleChange}
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </Input>
              </FormGroup>

              {form.cronPreset === '__custom__' && (
                <FormGroup>
                  <Label>Custom Cron Expression</Label>
                  <Input
                    name="cronCustom"
                    value={form.cronCustom}
                    onChange={handleChange}
                    placeholder="e.g.  0 8 * * 1-5  (weekdays at 8:00)"
                    required
                  />
                  <small className="text-muted">
                    Format: <code>minute hour day-of-month month day-of-week</code>
                  </small>
                </FormGroup>
              )}

              <p className="text-sm text-muted mb-0">
                <i className="ni ni-time-alarm mr-1" />
                Cron expression: <strong>{formToCronValue(form) || '—'}</strong>
              </p>
            </>
          )}

          {/* ── Sensor Threshold: sensor + condition ───────────────────── */}
          {form.triggerType === 'sensor_threshold' && (
            <>
              <FormGroup>
                <Label>Sensor</Label>
                {sensorsLoading ? (
                  <div><Spinner size="sm" color="primary" /> Loading sensors…</div>
                ) : (
                  <Input
                    type="select"
                    name="sensorId"
                    value={form.sensorId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Select a sensor —</option>
                    {sensors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type}) — {s.station?.name || 'no station'}
                      </option>
                    ))}
                  </Input>
                )}
              </FormGroup>

              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label>Condition</Label>
                    <Input
                      type="select"
                      name="condition"
                      value={form.condition}
                      onChange={handleChange}
                    >
                      <option value="above">Value is above threshold</option>
                      <option value="below">Value is below threshold</option>
                      <option value="any">Any reading (always trigger)</option>
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label>Threshold Value</Label>
                    <Input
                      type="number"
                      step="any"
                      name="threshold"
                      value={form.threshold}
                      onChange={handleChange}
                      placeholder="e.g. 7.5"
                      disabled={form.condition === 'any'}
                    />
                  </FormGroup>
                </Col>
              </Row>
            </>
          )}

          <hr className="my-3" />

          {/* Active toggle */}
          <FormGroup check>
            <Label check>
              <Input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
              />{' '}
              <span className="font-weight-bold">Active</span>
              <span className="text-muted ml-2 text-sm">
                — When checked, the trigger will fire automatically
              </span>
            </Label>
          </FormGroup>

          {form.triggerType === 'manual' && form.isActive && (
            <p className="text-muted text-sm mt-2 mb-0">
              Manual workflows are always available to run on demand; the "Active" flag has no effect.
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button color="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" type="submit">
            Save Settings
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
}
