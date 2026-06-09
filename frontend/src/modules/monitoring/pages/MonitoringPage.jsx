import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiEdit } from 'react-icons/fi';
import { FaTrash, FaEye } from 'react-icons/fa';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Col,
  Container,
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
  Table,
} from 'reactstrap';
import useSocket from '../../../hooks/useSocket';
import { selectUserRole } from '../../../store/slices/authSlice';
import {
  createSensor,
  deleteSensor,
  fetchSensors,
  selectSensors,
  selectSensorsError,
  selectSensorsLoading,
  selectSensorsSaving,
  updateSensor,
} from '../../../store/slices/sensorsSlice';
import { fetchStations, selectStations } from '../../../store/slices/stationsSlice';

const STATUS_COLORS = {
  active: 'success',
  inactive: 'secondary',
  faulty: 'danger',
  offline: 'dark',
};

const initialForm = {
  name: '',
  type: 'pressure',
  unit: 'bar',
  stationId: '',
  location: '',
  minThreshold: '',
  maxThreshold: '',
  status: 'active',
  alertEnabled: true,
  deviceId: '',
  serialNumber: '',
};

export default function MonitoringPage() {
  const dispatch = useDispatch();
  const sensors = useSelector(selectSensors);
  const stations = useSelector(selectStations);
  const isLoading = useSelector(selectSensorsLoading);
  const isSaving = useSelector(selectSensorsSaving);
  const error = useSelector(selectSensorsError);
  const userRole = useSelector(selectUserRole);
  const canManageSensors = ['admin', 'operator'].includes(userRole);
  const canDelete = userRole === 'admin';
  const navigate = useNavigate();

  const [stationFilter, setStationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useSocket(true);

  useEffect(() => {
    dispatch(fetchStations());
  }, [dispatch]);

  useEffect(() => {
    const params = {};
    if (stationFilter) params.stationId = stationFilter;
    if (typeFilter) params.type = typeFilter;
    dispatch(fetchSensors(params));
  }, [dispatch, stationFilter, typeFilter]);

  const openCreate = () => {
    setEditingSensor(null);
    setForm({ ...initialForm, stationId: stations[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (sensor) => {
    setEditingSensor(sensor);
    setForm({
      name: sensor.name || '',
      type: sensor.type || 'pressure',
      unit: sensor.unit || '',
      stationId: sensor.station?.id || '',
      location: sensor.location || '',
      minThreshold: sensor.minThreshold ?? '',
      maxThreshold: sensor.maxThreshold ?? '',
      status: sensor.status || 'active',
      alertEnabled: sensor.alertEnabled ?? true,
      deviceId: sensor.deviceId || '',
      serialNumber: sensor.serialNumber || '',
    });
    setModalOpen(true);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      minThreshold: form.minThreshold === '' ? undefined : Number(form.minThreshold),
      maxThreshold: form.maxThreshold === '' ? undefined : Number(form.maxThreshold),
    };

    if (editingSensor) {
      await dispatch(updateSensor({ id: editingSensor.id, payload }));
    } else {
      await dispatch(createSensor(payload));
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    dispatch(deleteSensor(deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <h1 className="text-white mb-0">Monitoring</h1>
              <p className="text-white-50 mb-0">Live sensor inventory and latest readings.</p>
            </Col>
            <Col className="text-right" xs="12" md="3">
              {canManageSensors && (
                <Button color="default" size="sm" onClick={openCreate} disabled={!stations.length}>
                  <i className="ni ni-fat-add mr-2" />
                  New Sensor
                </Button>
              )}
            </Col>
          </Row>
        </Container>
      </div>
      <Container className="mt--7" fluid>
        <Card className="shadow">
          <CardHeader className="border-0">
            <Row className="align-items-center mb-2">
              <Col>
                <h3 className="mb-0">Sensors</h3>
              </Col>
            </Row>
            <Row className="align-items-center gx-2">
              <Col xs="12" md="4">
                <Input
                  type="select"
                  bsSize="sm"
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                >
                  <option value="">All Stations</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Input>
              </Col>
              <Col xs="12" md="3">
                <Input
                  type="select"
                  bsSize="sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="pressure">Pressure</option>
                  <option value="flow">Flow</option>
                  <option value="temperature">Temperature</option>
                  <option value="quality">Quality</option>
                  <option value="level">Level</option>
                  <option value="ph">pH</option>
                  <option value="turbidity">Turbidity</option>
                  <option value="chlorine">Chlorine</option>
                </Input>
              </Col>
              {(stationFilter || typeFilter) && (
                <Col xs="auto">
                  <Button
                    size="sm"
                    color="link"
                    className="p-0 text-muted"
                    onClick={() => { setStationFilter(''); setTypeFilter(''); }}
                  >
                    Clear filters
                  </Button>
                </Col>
              )}
            </Row>
            {!stations.length && (
              <p className="text-warning text-sm mb-0 mt-2">Create a station first before adding sensors.</p>
            )}
            {error && <p className="text-danger text-sm mb-0 mt-2">{error}</p>}
          </CardHeader>
          <Table className="align-items-center table-flush" responsive>
            <thead className="thead-light">
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Station</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Last Reading</th>
                <th scope="col">Thresholds</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="7" className="text-center py-5"><Spinner color="primary" /></td></tr>
              ) : sensors.length ? (
                sensors.map((sensor) => (
                  <tr key={sensor.id}>
                    <th scope="row">{sensor.name}</th>
                    <td>{sensor.station?.name || <span className="text-muted">—</span>}</td>
                    <td className="text-capitalize">{sensor.type}</td>
                    <td>
                      <Badge color={STATUS_COLORS[sensor.status] || 'secondary'}>
                        {sensor.status}
                      </Badge>
                    </td>
                    <td>
                      {sensor.lastReading === null || sensor.lastReading === undefined ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <>
                          {Number(sensor.lastReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                          <span className="text-muted">{sensor.unit}</span>
                        </>
                      )}
                    </td>
                    <td>{sensor.minThreshold ?? '—'} / {sensor.maxThreshold ?? '—'}</td>
                    <td className="text-right">
                      <Button size="sm" color="default" title="View sensor" onClick={() => navigate(`/admin/monitoring/${sensor.id}`)}>
                        <FaEye />
                      </Button>
                      {canManageSensors && (
                        <>
                          <Button size="sm" color="info" className="ml-2" title="Edit sensor" onClick={() => openEdit(sensor)}>
                            <FiEdit />
                          </Button>
                          {canDelete && (
                            <Button size="sm" color="danger" className="ml-2" title="Delete sensor" onClick={() => setDeleteTarget(sensor)}>
                              <FaTrash />
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="text-center text-muted py-5">No sensors found.</td></tr>
              )}
            </tbody>
          </Table>
        </Card>
      </Container>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteTarget} toggle={() => setDeleteTarget(null)}>
        <ModalHeader toggle={() => setDeleteTarget(null)}>
          <span className="text-danger">
            <i className="ni ni-fat-remove mr-2" />
            Delete Sensor
          </span>
        </ModalHeader>
        <ModalBody>
          <p className="mb-1">Are you sure you want to delete this sensor?</p>
          <p className="font-weight-bold mb-0">{deleteTarget?.name}</p>
          {deleteTarget?.station && (
            <p className="text-muted text-sm mb-0">Station: {deleteTarget.station.name}</p>
          )}
          <p className="text-danger text-sm mt-3 mb-0">This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="danger" onClick={confirmDelete} disabled={isSaving}>
            {isSaving ? 'Deleting...' : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <ModalHeader toggle={() => setModalOpen(false)}>
            {editingSensor ? 'Edit Sensor' : 'Create Sensor'}
          </ModalHeader>
          <ModalBody>
            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Name</Label>
                  <Input name="name" value={form.name} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Station</Label>
                  <Input type="select" name="stationId" value={form.stationId} onChange={handleInputChange} required>
                    <option value="">Select station</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="4">
                <FormGroup>
                  <Label>Type</Label>
                  <Input type="select" name="type" value={form.type} onChange={handleInputChange}>
                    <option value="pressure">Pressure</option>
                    <option value="flow">Flow</option>
                    <option value="temperature">Temperature</option>
                    <option value="quality">Quality</option>
                    <option value="level">Level</option>
                    <option value="ph">pH</option>
                    <option value="turbidity">Turbidity</option>
                    <option value="chlorine">Chlorine</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Unit</Label>
                  <Input name="unit" value={form.unit} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Status</Label>
                  <Input type="select" name="status" value={form.status} onChange={handleInputChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="faulty">Faulty</option>
                    <option value="offline">Offline</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="4">
                <FormGroup>
                  <Label>Location</Label>
                  <Input name="location" value={form.location} onChange={handleInputChange} />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Min Threshold</Label>
                  <Input name="minThreshold" type="number" step="0.01" value={form.minThreshold} onChange={handleInputChange} />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Max Threshold</Label>
                  <Input name="maxThreshold" type="number" step="0.01" value={form.maxThreshold} onChange={handleInputChange} />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Device ID</Label>
                  <Input name="deviceId" value={form.deviceId} onChange={handleInputChange} />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Serial Number</Label>
                  <Input name="serialNumber" value={form.serialNumber} onChange={handleInputChange} />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup check>
              <Label check>
                <Input type="checkbox" name="alertEnabled" checked={form.alertEnabled} onChange={handleInputChange} />
                Enable threshold alerts
              </Label>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingSensor ? 'Update Sensor' : 'Create Sensor'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </>
  );
}
