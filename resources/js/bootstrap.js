import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
// Ensure axios sends cookies (session) for same-origin / cross-site requests
window.axios.defaults.withCredentials = true;
