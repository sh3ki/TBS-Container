import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.withCredentials = true; // Enable credentials for Sanctum

// Request interceptor to dynamically add CSRF token before each request
window.axios.interceptors.request.use(
    (config) => {
        // Get CSRF token from meta tag (dynamically on each request)
        const token = document.head.querySelector('meta[name="csrf-token"]');
        if (token) {
            config.headers['X-CSRF-TOKEN'] = token.getAttribute('content');
        }
        
        // Add Authorization token from localStorage
        const authToken = localStorage.getItem('auth_token');
        if (authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling errors
window.axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear auth data and redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        } else if (error.response?.status === 419) {
            // CSRF token mismatch - this shouldn't happen if Inertia is working correctly
            console.error('CSRF token mismatch. Reloading page to get fresh token...');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);
