import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiEdit } from 'react-icons/fi';
import { FaTrash } from 'react-icons/fa';
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
import { selectUserRole } from '../../../store/slices/authSlice';
import {
  createMaintenance,
  deleteMaintenance,
  fetchMaintenance,
  selectMaintenanceError,
  selectMaintenanceItems,
  selectMaintenanceLoading,
  selectMaintenanceSaving,
  updateMaintenance,
} from '../../../store/slices/maintenanceSlice';
import { fetchStations, selectStations } from '../../../store/slices/stationsSlice';
import { userService } from '../../../services/userService';

const PRIORITY_COLORS = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

const STATUS_COLORS = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'secondary',
  on_hold: 'dark',
};

const initialForm = {
  title: '',
  type: 'preventive',
  priority: 'medium',
  status: 'scheduled',
  stationId: '',
  assignedToId: '',
  description: '',
  scheduledDate: '',
};

export default function MaintenancePage() {
  const dispatch = useDispatch();
  const items = useSelector(selectMaintenanceItems);
  const stations = useSelector(selectStations);
  const isLoading = useSelector(selectMaintenanceLoading);
  const isSaving = useSelector(selectMaintenanceSaving);
  const error = useSelector(selectMaintenanceError);
  const userRole = useSelector(selectUserRole);

  const canCreate = ['admin', 'operator', 'technician'].includes(userRole);
  const canEdit = ['admin', 'operator', 'technician'].includes(userRole);
  const canDelete = userRole === 'admin';

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    dispatch(fetchStations());
    // Fetch all active users so the form can show a technician dropdown.
    // We fetch all roles so admins can also be assigned; filter by technician
    // is done in the dropdown label rather than restricting the API call.
    userService.getUsersDropdown('technician').then(setTechnicians).catch(() => setTechnicians([]));
  }, [dispatch]);

  useEffect(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    dispatch(fetchMaintenance(params));
  }, [dispatch, statusFilter, priorityFilter]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...initialForm, stationId: stations[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      type: item.type || 'preventive',
      priority: item.priority || 'medium',
      status: item.status || 'scheduled',
      stationId: item.station?.id || '',
      assignedToId: item.assignedTo?.id || '',
      description: item.description || '',
      scheduledDate: item.scheduledDate ? item.scheduledDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      scheduledDate: form.scheduledDate || undefined,
      // Send undefined (omit key) when unassigned so @IsUUID() validator doesn't reject empty string
      assignedToId: form.assignedToId || undefined,
    };

    if (editingItem) {
      await dispatch(updateMaintenance({ id: editingItem.id, payload }));
    } else {
      await dispatch(createMaintenance(payload));
    }
    setModalOpen(false);
  };

  const handleDelete = (item) => {
    setDeleteTarget(item);
  };

  const confirmDelete = () => {
    dispatch(deleteMaintenance(deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="header bg-gradient-warning pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <h1 className="text-white mb-0">Maintenance</h1>
              <p className="text-white-50 mb-0">Interventions, inspections, and repair tracking.</p>
            </Col>
            <Col className="text-right" xs="12" md="3">
              {canCreate && (
                <Button color="default" size="sm" onClick={openCreate}>
                  <i className="ni ni-fat-add mr-2" />
                  New Work Order
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
                <h3 className="mb-0">Maintenance Work Orders</h3>
              </Col>
            </Row>
            <Row className="align-items-center gx-2">
              <Col xs="12" md="3">
                <Input
                  type="select"
                  bsSize="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="on_hold">On Hold</option>
                </Input>
              </Col>
              <Col xs="12" md="3">
                <Input
                  type="select"
                  bsSize="sm"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Input>
              </Col>
              {(statusFilter || priorityFilter) && (
                <Col xs="auto">
                  <Button
                    size="sm"
                    color="link"
                    className="p-0 text-muted"
                    onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
                  >
                    Clear filters
                  </Button>
                </Col>
              )}
            </Row>
            {error && <p className="text-danger text-sm mb-0 mt-2">{error}</p>}
          </CardHeader>
          <Table className="align-items-center table-flush" responsive>
            <thead className="thead-light">
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Station</th>
                <th scope="col">Type · Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned To</th>
                <th scope="col">Scheduled</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <Spinner color="warning" />
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      {item.title}
                    </th>
                    <td>
                      {item.station?.name || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <Badge color={PRIORITY_COLORS[item.priority] || 'secondary'}>
                        {item.priority}
                      </Badge>
                      <span className="text-muted text-capitalize ml-1">
                        {item.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <Badge color={STATUS_COLORS[item.status] || 'secondary'}>
                        {item.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>
                      {item.assignedTo
                        ? `${item.assignedTo.firstname} ${item.assignedTo.lastname}`
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {item.scheduledDate
                        ? new Date(item.scheduledDate).toLocaleDateString()
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-right">
                      {canEdit && (
                        <Button
                          size="sm"
                          color="info"
                          title="Edit work order"
                          onClick={() => openEdit(item)}
                        >
                          <FiEdit />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          color="danger"
                          className="ml-2"
                          title="Delete work order"
                          onClick={() => handleDelete(item)}
                        >
                          <FaTrash />
                        </Button>
                      )}
                      {!canEdit && !canDelete && (
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>Read only</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-5">
                    No maintenance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </Container>

      <Modal isOpen={!!deleteTarget} toggle={() => setDeleteTarget(null)}>
        <ModalHeader toggle={() => setDeleteTarget(null)}>
          <span className="text-danger">
            <i className="ni ni-fat-remove mr-2" />
            Delete Work Order
          </span>
        </ModalHeader>
        <ModalBody>
          <p className="mb-1">
            Are you sure you want to delete this work order?
          </p>
          <p className="font-weight-bold mb-0">
            {deleteTarget?.title}
          </p>
          {deleteTarget?.station && (
            <p className="text-muted text-sm mb-0">
              Station: {deleteTarget.station.name}
            </p>
          )}
          <p className="text-danger text-sm mt-3 mb-0">
            This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button color="danger" onClick={confirmDelete} disabled={isSaving}>
            {isSaving ? 'Deleting...' : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <ModalHeader toggle={() => setModalOpen(false)}>
            {editingItem ? 'Edit Work Order' : 'New Work Order'}
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Title</Label>
              <Input
                name="title"
                value={form.title}
                onChange={handleInputChange}
                required
                placeholder="e.g. Quarterly pump inspection"
              />
            </FormGroup>
            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Type</Label>
                  <Input type="select" name="type" value={form.type} onChange={handleInputChange}>
                    <option value="preventive">Preventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="inspection">Inspection</option>
                    <option value="repair">Repair</option>
                    <option value="replacement">Replacement</option>
                    <option value="calibration">Calibration</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Priority</Label>
                  <Input type="select" name="priority" value={form.priority} onChange={handleInputChange}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Status</Label>
                  <Input type="select" name="status" value={form.status} onChange={handleInputChange}>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="on_hold">On Hold</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Station</Label>
                  <Input type="select" name="stationId" value={form.stationId} onChange={handleInputChange}>
                    <option value="">No station</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Assigned To</Label>
                  <Input
                    type="select"
                    name="assignedToId"
                    value={form.assignedToId}
                    onChange={handleInputChange}
                  >
                    <option value="">— Unassigned —</option>
                    {technicians.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstname} {u.lastname}
                      </option>
                    ))}
                  </Input>
                  {technicians.length === 0 && (
                    <small className="text-muted">Loading users…</small>
                  )}
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    name="scheduledDate"
                    value={form.scheduledDate}
                    onChange={handleInputChange}
                  />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Description</Label>
              <Input
                type="textarea"
                name="description"
                rows="3"
                value={form.description}
                onChange={handleInputChange}
                placeholder="Describe the work to be done..."
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingItem ? 'Update Work Order' : 'Create Work Order'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </>
  );
}
