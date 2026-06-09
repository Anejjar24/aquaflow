import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiEdit } from 'react-icons/fi';
import {
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
  fetchUsers,
  updateUser,
  clearUsersError,
  selectUsers,
  selectUsersMeta,
  selectUsersLoading,
  selectUsersSaving,
  selectUsersError,
} from '../../../store/slices/usersSlice';
import { selectUserRole, selectUser } from '../../../store/slices/authSlice';

const ROLE_COLORS = {
  admin: 'danger',
  operator: 'primary',
  technician: 'warning',
  analyst: 'info',
};

const initialEditForm = {
  role: 'operator',
  isActive: true,
};

export default function UsersPage() {
  const dispatch = useDispatch();
  const users = useSelector(selectUsers);
  const meta = useSelector(selectUsersMeta);
  const isLoading = useSelector(selectUsersLoading);
  const isSaving = useSelector(selectUsersSaving);
  const error = useSelector(selectUsersError);
  const userRole = useSelector(selectUserRole);
  const currentUser = useSelector(selectUser);

  // Only admins can access this page — guard at render level too
  const isAdmin = userRole === 'admin';

  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch with current filters
  useEffect(() => {
    const params = { page, limit: 20 };
    if (searchInput) params.search = searchInput;
    if (roleFilter) params.role = roleFilter;
    if (activeFilter !== '') params.isActive = activeFilter === 'true';
    dispatch(fetchUsers(params));
  }, [dispatch, page, searchInput, roleFilter, activeFilter]);

  // Reset page to 1 when filters change
  const handleSearchChange = (e) => {
    setPage(1);
    setSearchInput(e.target.value);
  };

  const handleRoleFilterChange = (e) => {
    setPage(1);
    setRoleFilter(e.target.value);
  };

  const handleActiveFilterChange = (e) => {
    setPage(1);
    setActiveFilter(e.target.value);
  };

  const clearFilters = () => {
    setSearchInput('');
    setRoleFilter('');
    setActiveFilter('');
    setPage(1);
    dispatch(clearUsersError());
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({ role: user.role, isActive: user.isActive });
    setModalOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      role: editForm.role,
      isActive: editForm.isActive === 'true' || editForm.isActive === true,
    };
    await dispatch(updateUser({ id: editingUser.id, payload }));
    setModalOpen(false);
  };

  const handleToggleActive = (user) => {
    // Prevent admin from deactivating themselves
    if (user.id === currentUser?.id) return;
    dispatch(updateUser({ id: user.id, payload: { isActive: !user.isActive } }));
  };

  return (
    <>
      <div className="header bg-gradient-dark pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <h1 className="text-white mb-0">User Management</h1>
              <p className="text-white-50 mb-0">Manage platform accounts, roles, and access.</p>
            </Col>
            <Col className="text-right" xs="12" md="3">
              <span className="text-white-50 text-sm">
                <i className="ni ni-single-02 mr-1" />
                {meta.total} total users
              </span>
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Card className="shadow">
          <CardHeader className="border-0">
            <Row className="align-items-center mb-2">
              <Col>
                <h3 className="mb-0">Users</h3>
              </Col>
            </Row>
            <Row className="align-items-center gx-2">
              <Col xs="12" md="4">
                <Input
                  placeholder="Search by name or email…"
                  bsSize="sm"
                  value={searchInput}
                  onChange={handleSearchChange}
                />
              </Col>
              <Col xs="12" md="3">
                <Input
                  type="select"
                  bsSize="sm"
                  value={roleFilter}
                  onChange={handleRoleFilterChange}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="technician">Technician</option>
                  <option value="analyst">Analyst</option>
                </Input>
              </Col>
              <Col xs="12" md="3">
                <Input
                  type="select"
                  bsSize="sm"
                  value={activeFilter}
                  onChange={handleActiveFilterChange}
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Input>
              </Col>
              {(searchInput || roleFilter || activeFilter) && (
                <Col xs="auto">
                  <Button
                    size="sm"
                    color="link"
                    className="p-0 text-muted"
                    onClick={clearFilters}
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
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Member Since</th>
                {isAdmin && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-5">
                    <Spinner color="dark" />
                  </td>
                </tr>
              ) : users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <div className="font-weight-bold">
                        {user.firstname} {user.lastname}
                        {user.id === currentUser?.id && (
                          <span className="ml-1 text-muted text-xs">(you)</span>
                        )}
                      </div>
                    </th>
                    <td>{user.email}</td>
                    <td>
                      <Badge color={ROLE_COLORS[user.role] || 'secondary'} className="text-capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td>
                      <Badge color={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : '—'}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <Button
                          size="sm"
                          color="info"
                          title="Edit role"
                          onClick={() => openEdit(user)}
                        >
                          <FiEdit />
                        </Button>
                        <Button
                          size="sm"
                          color={user.isActive ? 'warning' : 'success'}
                          className="ml-2"
                          disabled={user.id === currentUser?.id}
                          title={user.id === currentUser?.id ? 'Cannot change own account status' : (user.isActive ? 'Deactivate user' : 'Activate user')}
                          onClick={() => handleToggleActive(user)}
                        >
                          <i className={user.isActive ? 'ni ni-fat-remove' : 'ni ni-check-bold'} />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center text-muted py-5">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {/* Pagination */}
          {meta.pages > 1 && (
            <CardBody className="border-top">
              <Row className="align-items-center">
                <Col>
                  <span className="text-sm text-muted">
                    Page {meta.page} of {meta.pages} — {meta.total} users
                  </span>
                </Col>
                <Col className="text-right">
                  <Button
                    size="sm"
                    color="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <i className="ni ni-bold-left" />
                  </Button>
                  <Button
                    size="sm"
                    color="secondary"
                    className="ml-2"
                    disabled={page >= meta.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <i className="ni ni-bold-right" />
                  </Button>
                </Col>
              </Row>
            </CardBody>
          )}
        </Card>
      </Container>

      {/* Edit Role Modal */}
      <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)}>
        <Form onSubmit={handleEditSubmit}>
          <ModalHeader toggle={() => setModalOpen(false)}>
            Edit User — {editingUser?.firstname} {editingUser?.lastname}
          </ModalHeader>
          <ModalBody>
            <p className="text-muted text-sm mb-3">{editingUser?.email}</p>
            <FormGroup>
              <Label>Role</Label>
              <Input
                type="select"
                name="role"
                value={editForm.role}
                onChange={handleEditFormChange}
              >
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="technician">Technician</option>
                <option value="analyst">Analyst</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Account Status</Label>
              <Input
                type="select"
                name="isActive"
                value={String(editForm.isActive)}
                onChange={handleEditFormChange}
                disabled={editingUser?.id === currentUser?.id}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Input>
              {editingUser?.id === currentUser?.id && (
                <small className="text-muted">You cannot deactivate your own account.</small>
              )}
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </>
  );
}
