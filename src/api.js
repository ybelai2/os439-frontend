const API = (import.meta.env.VITE_API_URL || 'https://drillapi.onrender.com').replace(/\/$/, '');
export const getToken = () => sessionStorage.getItem('drill-token');
export const setToken = token => token ? sessionStorage.setItem('drill-token', token) : sessionStorage.removeItem('drill-token');
export async function api(path, { method = 'GET', body, signal } = {}) {
  const multipart = body instanceof FormData;
  const token = getToken();
  const response = await fetch(API + path, {
    method, signal,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('drill-session-expired'));
    }
    throw new Error(data.message || `Request failed (${response.status}). Please try again.`);
  }
  return response.status === 204 ? null : response.json();
}
