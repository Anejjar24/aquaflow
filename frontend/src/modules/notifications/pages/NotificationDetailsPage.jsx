import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Col,
  Container,
  Row,
  Spinner,
} from 'reactstrap';
import {
  fetchNotifications,
  markNotificationRead,
  selectNotifications,
  selectNotificationsLoading,
} from '../../../store/slices/notificationsSlice';

const TYPE_COLORS = {
  alert: 'danger',
  maintenance: 'warning',
  system: 'info',
  info: 'primary',
};

const STATUS_COLORS = {
  pending: 'warning',
  sent: 'info',
  delivered: 'success',
  failed: 'danger',
  read: 'secondary',
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

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleString();
}

export default function NotificationDetailsPage() {
  const { notificationId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const notifications = useSelector(selectNotifications);
  const isLoading = useSelector(selectNotificationsLoading);

  const notification = notifications.find((n) => n.id === notificationId);
  const hasItems = notifications.length > 0;

  // If the store is empty (e.g., direct URL navigation), load the first 100
  useEffect(() => {
    if (!hasItems) {
      dispatch(fetchNotifications({ limit: 100 }));
    }
  }, [dispatch, hasItems]);

  const handleMarkRead = () => {
    dispatch(markNotificationRead(notificationId));
  };

  /* ─── Loading state ──────────────────────────────────────────────────── */
  if (isLoading && !notification) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: 300 }}
      >
        <Spinner color="info" />
      </div>
    );
  }

  /* ─── Not found ──────────────────────────────────────────────────────── */
  if (!notification) {
    return (
      <Container className="mt-5" fluid>
        <Card className="shadow text-center p-5">
          <p className="text-muted mb-3">Notification not found.</p>
          <div>
            <Button color="info" size="sm" onClick={() => navigate('/admin/notifications')}>
              ← Back to Notifications
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  /* ─── Detail view ────────────────────────────────────────────────────── */
  const isUnread = !notification.readAt;

  return (
    <>
      {/* Header */}
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <Button
                color="default"
                size="sm"
                className="mb-3"
                onClick={() => navigate('/admin/notifications')}
              >
                ← Back to Notifications
              </Button>
              <h1 className="text-white mb-1">{notification.subject}</h1>
              <p className="text-white-50 mb-0">
                Received {formatDate(notification.createdAt)}
              </p>
            </Col>
            <Col xs="auto">
              <Badge
                color={TYPE_COLORS[notification.type] || 'secondary'}
                pill
                className="mr-2"
                style={{ fontSize: '0.85rem', padding: '0.4em 0.8em' }}
              >
                {notification.type}
              </Badge>
              {isUnread ? (
                <Badge color="primary" pill style={{ fontSize: '0.85rem', padding: '0.4em 0.8em' }}>
                  Unread
                </Badge>
              ) : (
                <Badge color="secondary" pill style={{ fontSize: '0.85rem', padding: '0.4em 0.8em' }}>
                  Read
                </Badge>
              )}
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Row>
          {/* ── Left column: field details ── */}
          <Col xl="7" className="mb-4">
            <Card className="shadow">
              <CardHeader className="bg-white border-0">
                <h3 className="mb-0">Notification Details</h3>
              </CardHeader>
              <CardBody>
                <dl className="row mb-0">
                  <DetailRow label="Subject" value={notification.subject} />
                  <DetailRow
                    label="Type"
                    value={
                      <Badge color={TYPE_COLORS[notification.type] || 'secondary'} pill>
                        {notification.type}
                      </Badge>
                    }
                  />
                  <DetailRow
                    label="Channel"
                    value={notification.channel?.replace('_', ' ')}
                  />
                  <DetailRow
                    label="Delivery status"
                    value={
                      <Badge color={STATUS_COLORS[notification.status] || 'secondary'}>
                        {notification.status}
                      </Badge>
                    }
                  />
                  <DetailRow label="Recipient" value={notification.recipient} />
                  <DetailRow label="Received" value={formatDate(notification.createdAt)} />
                  <DetailRow label="Sent at" value={formatDate(notification.sentAt)} />
                  <DetailRow label="Delivered at" value={formatDate(notification.deliveredAt)} />
                  <DetailRow label="Read at" value={formatDate(notification.readAt)} />
                  <DetailRow label="Failure reason" value={notification.failureReason} />
                  {notification.retryCount > 0 && (
                    <DetailRow label="Retry count" value={notification.retryCount} />
                  )}
                  {notification.alert && (
                    <DetailRow
                      label="Related alert"
                      value={notification.alert.message || notification.alert.id}
                    />
                  )}
                </dl>
              </CardBody>
            </Card>
          </Col>

          {/* ── Right column: message content ── */}
          <Col xl="5" className="mb-4">
            <Card className="shadow">
              <CardHeader className="bg-white border-0">
                <h3 className="mb-0">Message Content</h3>
              </CardHeader>
              <CardBody>
                {notification.content ? (
                  <p
                    className="text-sm mb-0"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}
                  >
                    {notification.content}
                  </p>
                ) : (
                  <p className="text-muted text-sm mb-0">No content.</p>
                )}
              </CardBody>
              {isUnread && (
                <CardFooter className="py-3">
                  <Button color="info" size="sm" onClick={handleMarkRead}>
                    <i className="ni ni-check-bold mr-1" />
                    Mark as Read
                  </Button>
                </CardFooter>
              )}
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}
