import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit } from 'react-icons/fi';
import { FaTrash, FaEye } from 'react-icons/fa';
import useSocket from '../../../hooks/useSocket';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
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
import {
  createStation,
  fetchStations,
  selectStations,
  selectStationsError,
  selectStationsFilters,
  selectStationsLoading,
  selectStationsMeta,
  selectStationsSaving,
  setStationFilters,
  updateStation,
  deleteStation,
} from '../../../store/slices/stationsSlice';
import { selectUserRole } from '../../../store/slices/authSlice';
import StationsMap from '../components/StationsMap';

const STATUS_COLORS = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
  offline: 'secondary',
};

const initialForm = {
  name: '',
  location: '',
  latitude: '',
  longitude: '',
  capacity: '',
  capacityUnit: 'm3',
  type: 'treatment',
  status: 'offline',
  description: '',
};

export default function StationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const stations = useSelector(selectStations);
  const meta = useSelector(selectStationsMeta);
  const filters = useSelector(selectStationsFilters);
  const isLoading = useSelector(selectStationsLoading);
  const isSaving = useSelector(selectStationsSaving);
  const error = useSelector(selectStationsError);
  const userRole = useSelector(selectUserRole);
  const canManageStations = ['admin', 'operator'].includes(userRole);
  useSocket(true);
  const [view, setView] = useState('table'); // 'table' | 'map'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    dispatch(fetchStations());
  }, [dispatch]);

  const summary = useMemo(() => {
    const counts = stations.reduce(
      (acc, station) => {
        acc[station.status] = (acc[station.status] || 0) + 1;
        return acc;
      },
      { normal: 0, warning: 0, critical: 0, offline: 0 }
    );
    return counts;
  }, [stations]);

  const openCreate = () => {
    setEditingStation(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEdit = (station) => {
    setEditingStation(station);
    setForm({
      name: station.name || '',
      location: station.location || '',
      latitude: station.latitude || '',
      longitude: station.longitude || '',
      capacity: station.capacity || '',
      capacityUnit: station.capacityUnit || 'm3',
      type: station.type || 'treatment',
      status: station.status || 'offline',
      description: station.description || '',
    });
    setModalOpen(true);
  };

  const handleFilterChange = (event) => {
    const nextFilters = {
      ...filters,
      [event.target.name]: event.target.value,
    };
    dispatch(setStationFilters(nextFilters));
    dispatch(fetchStations({ ...nextFilters, page: 1 }));
  };

  const handleInputChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      capacity: Number(form.capacity),
    };

    if (editingStation) {
      await dispatch(updateStation({ id: editingStation.id, payload }));
    } else {
      await dispatch(createStation(payload));
    }

    setModalOpen(false);
  };

  const handleDelete = (station) => {
    if (window.confirm(`Delete "${station.name}"? This cannot be undone.`)) {
      dispatch(deleteStation(station.id));
    }
  };

  return (
    <>
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <div className="header-body">
            <Row>
              {[
                ['normal', 'Normal'],
                ['warning', 'Warning'],
                ['critical', 'Critical'],
                ['offline', 'Offline'],
              ].map(([key, label]) => (
                <Col lg="3" md="6" key={key}>
                  <Card className="card-stats mb-4 mb-xl-0">
                    <CardBody>
                      <Row>
                        <div className="col">
                          <h5 className="card-title text-uppercase text-muted mb-0">{label}</h5>
                          <span className="h2 font-weight-bold mb-0">{summary[key] || 0}</span>
                        </div>
                        <Col className="col-auto">
                          <div className={`icon icon-shape bg-${STATUS_COLORS[key]} text-white rounded-circle shadow`}>
                            <i className="ni ni-building" />
                          </div>
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Row>
          <Col>
            <Card className="shadow">
              <CardHeader className="border-0">
                <Row className="align-items-center">
                  <Col>
                    <h3 className="mb-0">Stations</h3>
                    <p className="text-sm text-muted mb-0">Manage supervised water stations and operational status.</p>
                  </Col>
                  <Col className="text-right" xs="12" md="auto">
                    {/* Map / Table toggle */}
                    <div className="btn-group btn-group-sm mr-2" role="group">
                      <Button
                        color={view === 'table' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('table')}
                        title="Table view"
                      >
                        <i className="ni ni-bullet-list-67" />
                      </Button>
                      <Button
                        color={view === 'map' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('map')}
                        title="Map view"
                      >
                        <i className="ni ni-map-big" />
                      </Button>
                    </div>
                    {canManageStations && (
                      <Button color="primary" size="sm" onClick={openCreate}>
                        <i className="ni ni-fat-add mr-2" />
                        New Station
                      </Button>
                    )}
                  </Col>
                </Row>
              </CardHeader>

              {/* ── Table view ────────────────────────────────────────── */}
              {view === 'table' && (
                <>
                  <CardBody className="border-top">
                    <Row>
                      <Col md="4">
                        <Input
                          name="search"
                          placeholder="Search stations"
                          value={filters.search}
                          onChange={handleFilterChange}
                        />
                      </Col>
                      <Col md="4">
                        <Input type="select" name="status" value={filters.status} onChange={handleFilterChange}>
                          <option value="">All statuses</option>
                          <option value="normal">Normal</option>
                          <option value="warning">Warning</option>
                          <option value="critical">Critical</option>
                          <option value="offline">Offline</option>
                        </Input>
                      </Col>
                      <Col md="4">
                        <Input type="select" name="type" value={filters.type} onChange={handleFilterChange}>
                          <option value="">All types</option>
                          <option value="treatment">Treatment</option>
                          <option value="distribution">Distribution</option>
                          <option value="storage">Storage</option>
                          <option value="monitoring">Monitoring</option>
                        </Input>
                      </Col>
                    </Row>
                  </CardBody>

                  {error && <Alert color="danger" className="mx-4">{error}</Alert>}

                  <Table className="align-items-center table-flush" responsive>
                    <thead className="thead-light">
                      <tr>
                        <th scope="col">Station</th>
                        <th scope="col">Type</th>
                        <th scope="col">Status</th>
                        <th scope="col">Capacity</th>
                        <th scope="col">Sensors</th>
                        <th scope="col" className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5">
                            <Spinner color="primary" />
                          </td>
                        </tr>
                      ) : stations.length ? (
                        stations.map((station) => (
                          <tr key={station.id}>
                            <th scope="row">
                              <div className="font-weight-bold">{station.name}</div>
                              <span className="text-muted text-sm">{station.location}</span>
                            </th>
                            <td className="text-capitalize">{station.type}</td>
                            <td>
                              <Badge color={STATUS_COLORS[station.status] || 'secondary'}>{station.status}</Badge>
                            </td>
                            <td>{Number(station.capacity).toLocaleString()} {station.capacityUnit}</td>
                            <td>{station.sensors?.length || 0}</td>
                            <td className="text-right">
                              <Button color="default" size="sm" title="View details" onClick={() => navigate(`/admin/stations/${station.id}`)}>
                                <FaEye />
                              </Button>
                              {canManageStations && (
                                <>
                                  <Button color="info" size="sm" className="ml-2" title="Edit station" onClick={() => openEdit(station)}>
                                    <FiEdit />
                                  </Button>
                                  {userRole === 'admin' && (
                                    <Button color="danger" size="sm" className="ml-2" title="Delete station" onClick={() => handleDelete(station)}>
                                      <FaTrash />
                                    </Button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center text-muted py-5">
                            No stations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>

                  <CardBody className="border-top">
                    <span className="text-sm text-muted">
                      Showing {stations.length} of {meta.total} stations
                    </span>
                  </CardBody>
                </>
              )}

              {/* ── Map view ──────────────────────────────────────────── */}
              {view === 'map' && (
                isLoading ? (
                  <div className="text-center py-5">
                    <Spinner color="primary" />
                  </div>
                ) : (
                  <StationsMap stations={stations} />
                )
              )}
            </Card>
          </Col>
        </Row>
      </Container>

      <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <ModalHeader toggle={() => setModalOpen(false)}>
            {editingStation ? 'Edit Station' : 'Create Station'}
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
                  <Label>Location</Label>
                  <Input name="location" value={form.location} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="4">
                <FormGroup>
                  <Label>Latitude</Label>
                  <Input name="latitude" type="number" step="0.000001" value={form.latitude} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Longitude</Label>
                  <Input name="longitude" type="number" step="0.000001" value={form.longitude} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Capacity</Label>
                  <Input name="capacity" type="number" step="0.01" value={form.capacity} onChange={handleInputChange} required />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="4">
                <FormGroup>
                  <Label>Unit</Label>
                  <Input name="capacityUnit" value={form.capacityUnit} onChange={handleInputChange} />
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Type</Label>
                  <Input type="select" name="type" value={form.type} onChange={handleInputChange}>
                    <option value="treatment">Treatment</option>
                    <option value="distribution">Distribution</option>
                    <option value="storage">Storage</option>
                    <option value="monitoring">Monitoring</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md="4">
                <FormGroup>
                  <Label>Status</Label>
                  <Input type="select" name="status" value={form.status} onChange={handleInputChange}>
                    <option value="normal">Normal</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="offline">Offline</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Description</Label>
              <Input type="textarea" name="description" value={form.description} onChange={handleInputChange} />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Station'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </>
  );
}
