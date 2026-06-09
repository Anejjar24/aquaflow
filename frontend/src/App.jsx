import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AdminLayout from "layouts/Admin.js";
import AuthLayout from "layouts/Auth.js";
import ProtectedRoute from "modules/auth/components/ProtectedRoute";
import { clientSessionCleared, selectAccessToken, verifyUser } from "store/slices/authSlice";
import { resetRealtime } from "store/slices/realtimeSlice";
import { AUTH_SESSION_CLEARED_EVENT } from "services/authSession";

export default function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector(selectAccessToken);

  useEffect(() => {
    if (accessToken) {
      dispatch(verifyUser());
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    const handleSessionCleared = () => {
      dispatch(clientSessionCleared());
      dispatch(resetRealtime());
      navigate("/auth/login", { replace: true });
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, handleSessionCleared);
    return () => {
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, handleSessionCleared);
    };
  }, [dispatch, navigate]);

  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/*" element={<AuthLayout />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
