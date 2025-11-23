import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastLogin: string | null;
    isActive: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Register new user
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await api.post('/auth/register', data);
  return response.data.data;
};

/**
 * Login user
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post('/auth/login', credentials);
  return response.data.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data.data.user;
};

/**
 * Get user usage statistics
 */
export const getUserUsage = async () => {
  const response = await api.get('/user/usage');
  return response.data.data;
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  getUserUsage
};

