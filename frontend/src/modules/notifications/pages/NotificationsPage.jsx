import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Badge,
  Button,
  Card,
  CardFooter,
  CardHeader,
  Col,
  Container,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import useSocket from '../../../hooks/useSocket';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  selectNotifications,
  selectNotificationsLoading,
  selectNotificationsMeta,
  selectUnreadCount,
} from '../../../store/slices/notificationsSlice';

const TYPE_COLORS = {
  alert: 'danger',
  maintenance: 'warning',
  system: 'info',
  info: 'primary',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notifications = useSelector(selectNotifications);
  const isLoading = useSelector(selectNotificationsLoading);
  const meta = useSelector(selectNotificationsMeta);
  const unreadCount = useSelector(selectUnreadCount);

  useSocket(true);

  useEffect(() => {
    dispatch(fetchNotifications({ page: 1, limit: 20 }));
  }, [dispatch]);

  const handleMarkRead = (id) => {
    dispatch(markNotificationRead(id));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const handlePageChange = (page) => {
    dispatch(fetchNotifications({ page, limit: meta.limit }));
  };

  return (
    <>
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <h1 className="text-white mb-0">Notifications</h1>
              <p className="text-white-50 mb-0">
                System alerts and workflow events.
                {unreadCount > 0 && (
                  <span className="ml-2">
                    <Badge color="danger" pill>{unreadCount} unread</Badge>
                  </span>
                )}
              </p>
            </Col>
            {unreadCount > 0 && (
              <Col xs="auto">
                <Button color="default" size="sm" onClick={handleMarkAllRead}>
                  Mark all as read
                </Button>
              </Col>
            )}
          </Row>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Card className="shadow">
          <CardHeader className="border-0">
            <Row className="align-items-center">
              <Col>
                <h3 className="mb-0">
                  Notification Center
                  {isLoading && <Spinner size="sm" className="ml-2" />}
                </h3>
              </Col>
              <Col xs="auto">
                <small className="text-muted">{meta.total} total</small>
              </Col>
            </Row>
          </CardHeader>

          <Table className="align-items-center table-flush" responsive>
            <thead className="thead-light">
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Subject</th>
                <th scope="col">Content</th>
                <th scope="col">Received</th>
                <th scope="col">Status</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No notifications found.
                  </td>
                </tr>
              )}
              {notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <tr
                    key={n.id}
                    className={isUnread ? 'table-active' : ''}
                    onClick={() => navigate(`/admin/notifications/${n.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <Badge color={TYPE_COLORS[n.type] || 'secondary'} pill>
                        {n.type}
                      </Badge>
                    </td>
                    <td className={isUnread ? 'font-weight-bold' : ''}>
                      {n.subject}
                    </td>
                    <td>
                      {n.content}
                    </td>
                    <td>
                      {formatDate(n.createdAt)}
                    </td>
                    <td>
                      {isUnread ? (
                        <Badge color="primary" pill>Unread</Badge>
                      ) : (
                        <Badge color="secondary" pill>Read</Badge>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {isUnread && (
                        <Button
                          color="link"
                          size="sm"
                          className="p-0"
                          title="Mark as read"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          <i className="ni ni-check-bold" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {meta.pages > 1 && (
            <CardFooter className="py-4">
              <Row className="align-items-center justify-content-end">
                <Col xs="auto">
                  <Button
                    size="sm"
                    color="secondary"
                    disabled={meta.page <= 1}
                    onClick={() => handlePageChange(meta.page - 1)}
                  >
                    &laquo; Prev
                  </Button>{' '}
                  <span className="text-muted mx-2">
                    Page {meta.page} of {meta.pages}
                  </span>
                  <Button
                    size="sm"
                    color="secondary"
                    disabled={meta.page >= meta.pages}
                    onClick={() => handlePageChange(meta.page + 1)}
                  >
                    Next &raquo;
                  </Button>
                </Col>
              </Row>
            </CardFooter>
          )}
        </Card>
      </Container>
    </>
  );
}
