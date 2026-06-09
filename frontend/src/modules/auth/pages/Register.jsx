import React, { useState, useEffect } from "react";

import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
  Row,
  Col,
  Alert,
  Spinner,
} from "reactstrap";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";

import {
  registerUser,
  clearError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
} from "../../../store/slices/authSlice";

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const error = useSelector(selectAuthError);
  const isLoading = useSelector(selectAuthLoading);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      dispatch(clearError());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      alert("Passwords do not match");
      return;
    }

    const result = await dispatch(
      registerUser({
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        password: formData.password,
      })
    );

    if (registerUser.fulfilled.match(result)) {
      navigate("/admin/dashboard");
    }
  };

  return (
    <>
      <Col lg="8" md="10">
        <Card className="bg-secondary shadow border-0">
          <CardBody className="px-lg-5 py-lg-4">
            <div className="text-center text-muted mb-4">
              <small>sign up with credentials</small>
            </div>

            {error && (
              <Alert color="danger">
                {error}
              </Alert>
            )}

            <Form role="form" onSubmit={handleSubmit}>

              {/* First Name + Last Name */}
              <Row>
                <Col md="6">
                  <FormGroup>
                    <InputGroup className="input-group-alternative mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-hat-3" />
                        </InputGroupText>
                      </InputGroupAddon>

                      <Input
                        placeholder="First Name"
                        type="text"
                        name="firstname"
                        value={formData.firstname}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </InputGroup>
                  </FormGroup>
                </Col>

                <Col md="6">
                  <FormGroup>
                    <InputGroup className="input-group-alternative mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-single-02" />
                        </InputGroupText>
                      </InputGroupAddon>

                      <Input
                        placeholder="Last Name"
                        type="text"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </InputGroup>
                  </FormGroup>
                </Col>
              </Row>

              {/* Email */}
              <FormGroup>
                <InputGroup className="input-group-alternative mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>
                      <i className="ni ni-email-83" />
                    </InputGroupText>
                  </InputGroupAddon>

                  <Input
                    placeholder="Email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="new-email"
                    disabled={isLoading}
                  />
                </InputGroup>
              </FormGroup>

              {/* Password + Confirm Password */}
              <Row>
                <Col md="6">
                  <FormGroup>
                    <InputGroup className="input-group-alternative mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-lock-circle-open" />
                        </InputGroupText>
                      </InputGroupAddon>

                      <Input
                        placeholder="Password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        disabled={isLoading}
                      />
                    </InputGroup>
                  </FormGroup>
                </Col>

                <Col md="6">
                  <FormGroup>
                    <InputGroup className="input-group-alternative mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                          <i className="ni ni-key-25" />
                        </InputGroupText>
                      </InputGroupAddon>

                      <Input
                        placeholder="Confirm Password"
                        type="password"
                        name="passwordConfirm"
                        value={formData.passwordConfirm}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </InputGroup>
                  </FormGroup>
                </Col>
              </Row>

              {/* Submit */}
              <div className="text-center">
                <Button
                  className="mt-3"
                  color="primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Creating...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </div>
            </Form>
          </CardBody>
        </Card>

        <Row className="mt-3">
          <Col className="text-center" xs="12">
            <Link to="/auth/login" className="text-light">
              <small>Already have an account? Sign in</small>
            </Link>
          </Col>
        </Row>
      </Col>
    </>
  );
}