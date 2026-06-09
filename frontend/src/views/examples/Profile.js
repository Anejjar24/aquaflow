import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "store/slices/authSlice";
import apiClient from "services/apiClient";

// reactstrap components
import {
  Badge,
  Card,
  CardHeader,
  CardBody,
  FormGroup,
  Form,
  Input,
  Container,
  Row,
  Col,
  Spinner,
} from "reactstrap";
// core components
import UserHeader from "components/Headers/UserHeader.js";

// Badge color per role
const ROLE_BADGE_COLOR = {
  admin: "danger",      // red
  operator: "primary",  // blue
  technician: "success", // green
  analyst: "warning",   // yellow
};

// Format a date as "May 2026"
const formatMemberSince = (dateValue) => {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const Profile = () => {
  const reduxUser = useSelector(selectUser);

  // fullUser holds either the Redux user enriched with createdAt, or the API response
  const [fullUser, setFullUser] = useState(reduxUser || null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    // If we already have createdAt (e.g. from verifyUser thunk), no need to fetch
    if (reduxUser?.createdAt) {
      setFullUser(reduxUser);
      return;
    }

    // Otherwise call GET /auth/me to get the full user object including createdAt
    const fetchFullUser = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await apiClient.get("/auth/me");
        setFullUser(response.data);
      } catch (err) {
        setFetchError("Could not load profile details.");
        // Fall back to whatever Redux has
        setFullUser(reduxUser || null);
      } finally {
        setLoading(false);
      }
    };

    fetchFullUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduxUser?.id]);

  // Derived display values — safe even when fullUser is null
  const firstname  = fullUser?.firstname  || "";
  const lastname   = fullUser?.lastname   || "";
  const email      = fullUser?.email      || "";
  const role       = fullUser?.role       || "";
  const isActive   = fullUser?.isActive   ?? true;
  const memberSince = formatMemberSince(fullUser?.createdAt);
  const roleBadgeColor = ROLE_BADGE_COLOR[role] || "secondary";

  return (
    <>
      <UserHeader />
      {/* Page content */}
      <Container className="mt--7" fluid>
        <Row>
          {/* Left column — profile summary card */}
          <Col className="order-xl-2 mb-5 mb-xl-0" xl="4">
            <Card className="card-profile shadow">
              <CardBody className="pt-0 pt-md-4">
                <div className="text-center mt-md-5 mb-4">
                  {/* Avatar placeholder using initials */}
                  <div
                    className="rounded-circle mx-auto d-flex align-items-center justify-content-center bg-gradient-primary text-white"
                    style={{ width: 80, height: 80, fontSize: 28, fontWeight: 700 }}
                  >
                    {firstname ? firstname.charAt(0).toUpperCase() : "?"}
                    {lastname  ? lastname.charAt(0).toUpperCase()  : ""}
                  </div>

                  {loading ? (
                    <div className="mt-3">
                      <Spinner size="sm" color="primary" />
                    </div>
                  ) : (
                    <>
                      <h3 className="mt-3 mb-1">
                        {firstname || lastname
                          ? `${firstname} ${lastname}`.trim()
                          : "—"}
                      </h3>

                      <div className="mb-2">
                        {role && (
                          <Badge color={roleBadgeColor} className="mr-2 text-capitalize">
                            {role}
                          </Badge>
                        )}
                        <Badge color={isActive ? "success" : "secondary"}>
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="text-muted font-weight-300 small">
                        <i className="ni ni-email-83 mr-1" />
                        {email || "—"}
                      </div>

                      {fullUser?.createdAt && (
                        <div className="text-muted font-weight-300 small mt-1">
                          <i className="ni ni-calendar-grid-58 mr-1" />
                          Member since {memberSince}
                        </div>
                      )}

                      {fetchError && (
                        <div className="text-warning small mt-2">
                          <i className="ni ni-bell-55 mr-1" />
                          {fetchError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          </Col>

          {/* Right column — account form */}
          <Col className="order-xl-1" xl="8">
            <Card className="bg-secondary shadow">
              <CardHeader className="bg-white border-0">
                <Row className="align-items-center">
                  <Col xs="8">
                    <h3 className="mb-0">My account</h3>
                  </Col>
                  <Col className="text-right" xs="4">
                    {/* Role + status badges in the header for quick reference */}
                    {role && (
                      <Badge color={roleBadgeColor} className="mr-2 text-capitalize">
                        {role}
                      </Badge>
                    )}
                    <Badge color={isActive ? "success" : "secondary"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Col>
                </Row>
              </CardHeader>

              <CardBody>
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner color="primary" />
                    <p className="mt-2 text-muted">Loading profile…</p>
                  </div>
                ) : (
                  <Form>
                    {/* ── User information ── */}
                    <h6 className="heading-small text-muted mb-4">
                      User information
                    </h6>
                    <div className="pl-lg-4">
                      <Row>
                        <Col lg="6">
                          <FormGroup>
                            <label
                              className="form-control-label"
                              htmlFor="input-first-name"
                            >
                              First name
                            </label>
                            <Input
                              className="form-control-alternative"
                              id="input-first-name"
                              value={firstname}
                              placeholder="First name"
                              type="text"
                              readOnly
                            />
                          </FormGroup>
                        </Col>
                        <Col lg="6">
                          <FormGroup>
                            <label
                              className="form-control-label"
                              htmlFor="input-last-name"
                            >
                              Last name
                            </label>
                            <Input
                              className="form-control-alternative"
                              id="input-last-name"
                              value={lastname}
                              placeholder="Last name"
                              type="text"
                              readOnly
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                      <Row>
                        <Col lg="6">
                          <FormGroup>
                            <label
                              className="form-control-label"
                              htmlFor="input-email"
                            >
                              Email address
                            </label>
                            <Input
                              className="form-control-alternative"
                              id="input-email"
                              value={email}
                              placeholder="Email address"
                              type="email"
                              readOnly
                            />
                          </FormGroup>
                        </Col>
                        <Col lg="6">
                          <FormGroup>
                            <label
                              className="form-control-label"
                              htmlFor="input-member-since"
                            >
                              Member since
                            </label>
                            <Input
                              className="form-control-alternative"
                              id="input-member-since"
                              value={memberSince}
                              placeholder="—"
                              type="text"
                              readOnly
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                    </div>

                    <hr className="my-4" />

                    {/* ── Account details ── */}
                    <h6 className="heading-small text-muted mb-4">
                      Account details
                    </h6>
                    <div className="pl-lg-4">
                      <Row>
                        <Col lg="6">
                          <FormGroup>
                            <label className="form-control-label">Role</label>
                            <div className="mt-2">
                              {role ? (
                                <Badge
                                  color={roleBadgeColor}
                                  className="text-capitalize"
                                  style={{ fontSize: "0.85rem", padding: "0.45em 0.8em" }}
                                >
                                  {role}
                                </Badge>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </div>
                          </FormGroup>
                        </Col>
                        <Col lg="6">
                          <FormGroup>
                            <label className="form-control-label">
                              Account status
                            </label>
                            <div className="mt-2">
                              <Badge
                                color={isActive ? "success" : "secondary"}
                                style={{ fontSize: "0.85rem", padding: "0.45em 0.8em" }}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </FormGroup>
                        </Col>
                      </Row>
                    </div>
                  </Form>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Profile;