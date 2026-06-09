import { Badge, Card, CardBody, CardHeader, ListGroup, ListGroupItem } from 'reactstrap';

const SEVERITY_COLORS = {
  critical: 'danger',
  error: 'danger',
  warning: 'warning',
  high: 'warning',
  medium: 'info',
  info: 'info',
  low: 'success',
};

export default function AlertsFeed({ alerts }) {
  return (
    <Card className="shadow">
      <CardHeader className="border-0 d-flex align-items-center justify-content-between">
        <h3 className="mb-0">Active Alerts</h3>
        <Badge color="danger" pill>{alerts.length}</Badge>
      </CardHeader>
      <CardBody className="p-0">
        <ListGroup flush>
          {alerts.map((alert) => (
            <ListGroupItem className="px-4" key={alert.id}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <Badge color={SEVERITY_COLORS[alert.severity] || 'secondary'} className="mb-2">
                    {alert.severity}
                  </Badge>
                  <h4 className="mb-1">{alert.station}</h4>
                  <p className="text-sm text-muted mb-0">{alert.message}</p>
                </div>
                <span className="text-xs text-muted ml-3">{alert.time}</span>
              </div>
            </ListGroupItem>
          ))}
          {alerts.length === 0 && (
            <ListGroupItem className="px-4 text-sm text-muted">
              No active alerts.
            </ListGroupItem>
          )}
        </ListGroup>
      </CardBody>
    </Card>
  );
}
