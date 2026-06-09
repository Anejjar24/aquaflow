/*!

=========================================================
* Argon Dashboard React - v1.2.4
=========================================================

* Product Page: https://www.creative-tim.com/product/argon-dashboard-react
* Copyright 2024 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/argon-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import useLogout from "hooks/useLogout";
import { selectUser } from "store/slices/authSlice";
import {
  fetchUnreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  selectUnreadCount,
  selectNotifications,
} from "store/slices/notificationsSlice";
// reactstrap components
import {
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  DropdownToggle,
  Form,
  FormGroup,
  InputGroupAddon,
  InputGroupText,
  Input,
  InputGroup,
  Navbar,
  Nav,
  Container,
  Media,
  Badge,
} from "reactstrap";

const AdminNavbar = (props) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const logout = useLogout();
  const unreadCount = useSelector(selectUnreadCount);
  const notifications = useSelector(selectNotifications);

  const displayName = user
    ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email
    : "AquaFlow User";

  // Fetch unread count and first page of notifications on mount
  useEffect(() => {
    dispatch(fetchUnreadCount());
    dispatch(fetchNotifications({ limit: 8, page: 1 }));
  }, [dispatch]);

  const handleMarkRead = (e, id) => {
    e.stopPropagation();
    dispatch(markNotificationRead(id));
  };

  const handleMarkAllRead = (e) => {
    e.preventDefault();
    dispatch(markAllNotificationsRead());
  };

  const recentNotifications = notifications.slice(0, 5);

  const severityIcon = (severity) => {
    switch (severity) {
      case "critical":
        return "ni ni-bell-55 text-danger";
      case "high":
        return "ni ni-bell-55 text-warning";
      case "medium":
        return "ni ni-bell-55 text-info";
      default:
        return "ni ni-bell-55 text-muted";
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <Navbar className="navbar-top navbar-dark" expand="md" id="navbar-main">
        <Container fluid>
          <Link
            className="h4 mb-0 text-white text-uppercase d-none d-lg-inline-block"
            to="/"
          >
            {props.brandText}
          </Link>
          <Form className="navbar-search navbar-search-dark form-inline mr-3 d-none d-md-flex ml-lg-auto">
            <FormGroup className="mb-0">
              <InputGroup className="input-group-alternative">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>
                    <i className="fas fa-search" />
                  </InputGroupText>
                </InputGroupAddon>
                <Input placeholder="Search" type="text" />
              </InputGroup>
            </FormGroup>
          </Form>
          <Nav className="align-items-center d-none d-md-flex" navbar>
            {/* ── Notifications Bell ─────────────────────────────────── */}
            <UncontrolledDropdown nav className="mr-2">
              <DropdownToggle nav className="nav-link-icon position-relative">
                <i className="ni ni-bell-55 text-white" style={{ fontSize: "1.1rem" }} />
                {unreadCount > 0 && (
                  <Badge
                    color="danger"
                    pill
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      fontSize: "0.65rem",
                      minWidth: "18px",
                      height: "18px",
                      lineHeight: "18px",
                      padding: "0 4px",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </DropdownToggle>
              <DropdownMenu
                className="dropdown-menu-arrow"
                right
                style={{ minWidth: "340px", maxHeight: "420px", overflowY: "auto" }}
              >
                {/* Header */}
                <DropdownItem className="noti-title" header tag="div">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="text-overflow m-0">
                      Notifications
                      {unreadCount > 0 && (
                        <Badge color="danger" pill className="ml-2">
                          {unreadCount}
                        </Badge>
                      )}
                    </h6>
                    {unreadCount > 0 && (
                      <a
                        href="#mark-all"
                        className="text-primary small"
                        onClick={handleMarkAllRead}
                      >
                        Mark all read
                      </a>
                    )}
                  </div>
                </DropdownItem>

                {/* Notification items */}
                {recentNotifications.length === 0 ? (
                  <DropdownItem disabled>
                    <div className="text-center text-muted py-2">
                      <i className="ni ni-bell-55 mr-2" />
                      No notifications
                    </div>
                  </DropdownItem>
                ) : (
                  recentNotifications.map((n) => (
                    <DropdownItem
                      key={n.id}
                      className={`py-2${!n.readAt ? " bg-lighter" : ""}`}
                      style={{ whiteSpace: "normal", cursor: "pointer" }}
                      toggle={false}
                    >
                      <div className="d-flex align-items-start">
                        <div className="mr-2 mt-1">
                          <i className={severityIcon(n.severity)} />
                        </div>
                        <div className="flex-grow-1">
                          <p
                            className="mb-0 text-sm"
                            style={{
                              fontWeight: n.readAt ? "normal" : "600",
                              lineHeight: "1.3",
                            }}
                          >
                            {n.title || n.message}
                          </p>
                          {n.title && (
                            <p className="mb-0 text-xs text-muted">{n.message}</p>
                          )}
                          <small className="text-muted">{timeAgo(n.createdAt)}</small>
                        </div>
                        {!n.readAt && (
                          <button
                            className="btn btn-sm btn-link text-primary p-0 ml-2"
                            style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}
                            onClick={(e) => handleMarkRead(e, n.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </DropdownItem>
                  ))
                )}

                {/* Footer link */}
                <DropdownItem divider />
                <DropdownItem to="/admin/notifications" tag={Link} className="text-center">
                  <small className="text-primary font-weight-bold">
                    View all notifications
                  </small>
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>

            {/* ── User Profile Dropdown ──────────────────────────────── */}
            <UncontrolledDropdown nav>
              <DropdownToggle className="pr-0" nav>
                <Media className="align-items-center">
                  <span className="avatar avatar-sm rounded-circle">
                    <img
                      alt="..."
                      src={require("../../assets/img/theme/team-4-800x800.jpg")}
                    />
                  </span>
                  <Media className="ml-2 d-none d-lg-block">
                    <span className="mb-0 text-sm font-weight-bold">
                      {displayName}
                    </span>
                  </Media>
                </Media>
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-arrow" right>
                <DropdownItem className="noti-title" header tag="div">
                  <h6 className="text-overflow m-0">Welcome!</h6>
                </DropdownItem>
                <DropdownItem to="/admin/user-profile" tag={Link}>
                  <i className="ni ni-single-02" />
                  <span>My profile</span>
                </DropdownItem>
                <DropdownItem to="/admin/user-profile" tag={Link}>
                  <i className="ni ni-settings-gear-65" />
                  <span>Settings</span>
                </DropdownItem>
                <DropdownItem to="/admin/user-profile" tag={Link}>
                  <i className="ni ni-calendar-grid-58" />
                  <span>Activity</span>
                </DropdownItem>
                <DropdownItem to="/admin/user-profile" tag={Link}>
                  <i className="ni ni-support-16" />
                  <span>Support</span>
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem
                  href="#pablo"
                  onClick={(e) => {
                    e.preventDefault();
                    logout();
                  }}
                >
                  <i className="ni ni-user-run" />
                  <span>Logout</span>
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
};

export default AdminNavbar;
