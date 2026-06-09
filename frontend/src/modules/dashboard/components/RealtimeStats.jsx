import { Badge, Card, CardBody, CardHeader, ListGroup, ListGroupItem } from 'reactstrap';

export default function RealtimeStats({ realtime }) {
  return (
    <Card className="shadow">
      <CardHeader className="border-0 d-flex align-items-center justify-content-between">
        <h3 className="mb-0">Realtime Pipeline</h3>
        <Badge color={realtime.connected ? 'success' : 'secondary'} pill>
          {realtime.connected ? 'connected' : 'offline'}
        </Badge>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-muted">
          Socket.IO dashboard subscriptions are ready for sensor, station, and alert events.
        </p>
        <ListGroup flush>
          {realtime.events.slice(0, 5).map((event) => (
            <ListGroupItem className="px-0" key={event.id}>
              <div className="d-flex justify-content-between">
                <span className="font-weight-bold text-sm">{event.label}</span>
                <span className="text-xs text-muted">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </ListGroupItem>
          ))}
          {realtime.events.length === 0 && (
            <ListGroupItem className="px-0 text-sm text-muted">
              Waiting for realtime events
            </ListGroupItem>
          )}
        </ListGroup>
      </CardBody>
    </Card>
  );
}
