import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Spinner } from 'reactstrap';
import {
  selectAuthLoading,
  selectIsAuthenticated,
  selectUser,
} from '../../../store/slices/authSlice';

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);
  const user = useSelector(selectUser);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Token is present but verifyUser hasn't returned yet — hold rendering
  // until the user object is populated so role-gated UI renders correctly.
  if (isLoading && !user) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner color="primary" />
      </div>
    );
  }

  return children;
}
