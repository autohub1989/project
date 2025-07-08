export const getToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const setToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('authToken');
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;
  
  try {
    // Check if token has the correct format (JWT has 3 parts separated by dots)
    if (token.split('.').length !== 3) {
      return false;
    }
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Check if token has expiration and if it's still valid
    if (payload.exp) {
      return payload.exp > Date.now() / 1000;
    }
    // If no expiration, consider it valid (for development)
    return true;
  } catch {
    return false;
  }
};