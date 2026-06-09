import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import { resetRealtime } from '../store/slices/realtimeSlice';

export default function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return useCallback(async () => {
    await dispatch(logoutUser());
    dispatch(resetRealtime());
    navigate('/auth/login', { replace: true });
  }, [dispatch, navigate]);
}
