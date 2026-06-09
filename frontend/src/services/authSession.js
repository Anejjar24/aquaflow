export const AUTH_SESSION_CLEARED_EVENT = 'aquaflow:auth-session-cleared';

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function persistAuthSession({ accessToken, refreshToken }) {
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
  }

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export function clearAuthSession(reason = 'logout') {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');

  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_CLEARED_EVENT, {
      detail: { reason },
    })
  );
}
