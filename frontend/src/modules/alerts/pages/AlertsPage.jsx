import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import useSocket from '../../../hooks/useSocket';
import alertService from '../../../services/alertService';
import { selectUserRole } from '../../../store/slices/authSlice';
import {
  acknowledgeAlert,
  fetchAlerts,
  resolveAlert,
  selectAlerts,
  selectAlertsError,
  selectAlertsLoading,
} from '../../../store/slices/alertsSlice';

const SEVERITY_COLORS = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
};

const STATUS_COLORS = {
  active: 'danger',
  acknowledged: 'warning',
  resolved: 'success',
  suppressed: 'secondary',
};

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <>
      <dt className="col-sm-4 text-muted">{label}</dt>
      <dd className="col-sm-8">{value}</dd>
    </>
  );
}

export default function AlertsPage() {
  const dispatch = useDispatch();
  const alerts = useSelector(selectAlerts);
  const isLoading = useSelector(selectAlertsLoading);
  const error = useSelector(selectAlertsError);
  const userRole = useSelector(selectUserRole);
  const canManageAlerts = ['admin', 'operator', 'technician'].includes(userRole);

  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useSocket(true);

  useEffect(() => {
    const params = {};
    if (severityFilter) params.severity = severityFilter;
    if (statusFilter) params.status = statusFilter;
    dispatch(fetchAlerts(params));
  }, [dispatch, severityFilter, statusFilter]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;
      const blob = await alertService.exportCsv(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alerts.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAcknowledge = (alert) => {
    dispatch(acknowledgeAlert(alert.id));
    setSelectedAlert((prev) => prev?.id === alert.id ? { ...prev, status: 'acknowledged' } : prev);
  };

  const handleResolve = (alert) => {
    dispatch(resolveAlert(alert.id));
    setSelectedAlert((prev) => prev?.id === alert.id ? { ...prev, status: 'resolved' } : prev);
  };

  return (
    <>
      <div className="header bg-gradient-danger pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <h1 className="text-white mb-0">Alerts</h1>
              <p className="text-white-50 mb-0">Operational alerts and intervention signals.</p>
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Card className="shadow">
          <CardHeader className="border-0">
            <Row className="align-items-center">
              <Col>
                <h3 className="mb-0">Alert Center</h3>
              </Col>
              <Col xs="12" md="auto">
                <Row className="align-items-center gx-2">
                  <Col xs="auto">
                    <Input
                      type="select"
                      bsSize="sm"
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                      <option value="">All Severities</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                      <option value="critical">Critical</option>
                    </Input>
                  </Col>
                  <Col xs="auto">
                    <Input
                      type="select"
                      bsSize="sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="resolved">Resolved</option>
                    </Input>
                  </Col>
                  {(severityFilter || statusFilter) && (
                    <Col xs="auto">
                      <Button
                        size="sm"
                        color="link"
                        className="text-muted p-0"
                        onClick={() => { setSeverityFilter(''); setStatusFilter(''); }}
                      >
                        Clear
                      </Button>
                    </Col>
                  )}
                  <Col xs="auto">
                    <Button
                      size="sm"
                      color="default"
                      disabled={isExporting}
                      onClick={handleExport}
                    >
                      <i className="ni ni-cloud-download-95 mr-1" />
                      {isExporting ? 'Exporting…' : 'Export CSV'}
                    </Button>
                  </Col>
                </Row>
              </Col>
            </Row>
            {error && <p className="text-danger text-sm mb-0 mt-2">{error}</p>}
          </CardHeader>

          <Table className="align-items-center table-flush" responsive>
            <thead className="thead-light">
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Message</th>
                <th scope="col">Station</th>
                <th scope="col">Sensor</th>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <Spinner color="danger" />
                  </td>
                </tr>
              ) : alerts.length ? (
                alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <Badge color={SEVERITY_COLORS[alert.severity] || 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </td>
                    <th scope="row">
                      {alert.message}
                    </th>
                    <td>
                      {alert.station?.name || '-'}
                    </td>
                    <td>
                      {alert.sensor?.name || '-'}
                    </td>
                    <td>
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '-'}
                    </td>
                    <td>
                      <Badge color={STATUS_COLORS[alert.status] || 'secondary'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canManageAlerts ? (
                        <>
                          <Button
                            size="sm"
                            color="warning"
                            title="Acknowledge"
                            disabled={alert.status !== 'active'}
                            onClick={() => handleAcknowledge(alert)}
                          >
                            <i className="ni ni-check-bold" />
                          </Button>
                          <Button
                            size="sm"
                            color="success"
                            className="ml-2"
                            title="Resolve"
                            disabled={alert.status === 'resolved'}
                            onClick={() => handleResolve(alert)}
                          >
                            <i className="ni ni-like-2" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted text-sm">Read only</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-5">
                    No alerts found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </Container>

      {/* Alert Detail Modal */}
      <Modal isOpen={!!selectedAlert} toggle={() => setSelectedAlert(null)} size="lg">
        {selectedAlert && (
          <>
            <ModalHeader toggle={() => setSelectedAlert(null)}>
              <span>
                <Badge
                  color={SEVERITY_COLORS[selectedAlert.severity] || 'secondary'}
                  className="mr-2"
                >
                  {selectedAlert.severity?.toUpperCase()}
                </Badge>
                Alert Details
              </span>
            </ModalHeader>
            <ModalBody>
              <CardBody className="px-0 pt-0">
                <dl className="row mb-0">
                  <DetailRow label="Message" value={selectedAlert.message} />
                  <DetailRow label="Description" value={selectedAlert.description} />
                  <DetailRow label="Type" value={selectedAlert.type?.replace(/_/g, ' ')} />
                  <DetailRow label="Severity" value={
                    <Badge color={SEVERITY_COLORS[selectedAlert.severity] || 'secondary'}>
                      {selectedAlert.severity}
                    </Badge>
                  } />
                  <DetailRow label="Status" value={
                    <Badge color={STATUS_COLORS[selectedAlert.status] || 'secondary'}>
                      {selectedAlert.status}
                    </Badge>
                  } />
                  <DetailRow label="Station" value={selectedAlert.station?.name} />
                  <DetailRow label="Sensor" value={selectedAlert.sensor?.name} />
                  <DetailRow
                    label="Created"
                    value={selectedAlert.createdAt ? new Date(selectedAlert.createdAt).toLocaleString() : null}
                  />
                  <DetailRow
                    label="Acknowledged at"
                    value={selectedAlert.acknowledgedAt ? new Date(selectedAlert.acknowledgedAt).toLocaleString() : null}
                  />
                  <DetailRow
                    label="Resolved at"
                    value={selectedAlert.resolvedAt ? new Date(selectedAlert.resolvedAt).toLocaleString() : null}
                  />
                  <DetailRow label="Source system" value={selectedAlert.sourceSystem} />
                  {selectedAlert.data && Object.keys(selectedAlert.data).length > 0 && (
                    <>
                      <dt className="col-sm-4 text-muted">Raw data</dt>
                      <dd className="col-sm-8">
                        <pre
                          className="mb-0"
                          style={{ fontSize: '0.78rem', background: '#f8f9fa', padding: '0.5rem', borderRadius: 4 }}
                        >
                          {JSON.stringify(selectedAlert.data, null, 2)}
                        </pre>
                      </dd>
                    </>
                  )}
                </dl>
              </CardBody>
            </ModalBody>
            <ModalFooter>
              {canManageAlerts && (
                <>
                  <Button
                    color="warning"
                    size="sm"
                    disabled={selectedAlert.status !== 'active'}
                    onClick={() => handleAcknowledge(selectedAlert)}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    color="success"
                    size="sm"
                    disabled={selectedAlert.status === 'resolved'}
                    onClick={() => handleResolve(selectedAlert)}
                  >
                    Resolve
                  </Button>
                </>
              )}
              <Button color="secondary" size="sm" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}
