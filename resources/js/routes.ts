/**
 * Application Routes
 * 
 * This file exports route helper functions to generate URLs for the application.
 * Uses Ziggy-like syntax for type-safe route generation.
 */

export const home = () => '/';
export const dashboard = () => '/dashboard';

// Auth routes
export const login = () => '/login';
export const register = () => '/register';
export const logout = () => '/logout';
export const forgotPassword = () => '/forgot-password';
export const resetPassword = (token?: string) => token ? `/reset-password/${token}` : '/reset-password';
export const verifyEmail = () => '/verify-email';

// User routes
export const profile = () => '/profile';
export const profileEdit = () => '/profile/edit';

// Export all routes as a single object for convenience
export default {
  home,
  dashboard,
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  profile,
  profileEdit,
};
