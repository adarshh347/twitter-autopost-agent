
import axios from 'axios';

const API_URL = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export const auth = {
    login: async (username: string, password: string) => {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        const res = await api.post('/token', formData);
        if (res.data.access_token) {
            localStorage.setItem('token', res.data.access_token);
        }
        return res.data;
    },
    logout: () => {
        localStorage.removeItem('token');
    },
    connectBrowser: () => api.post('/auth/connect-browser'),
    saveSession: () => api.post('/auth/save-session'),
};

// Session management for persistent browser
export const session = {
    start: () => api.post('/session/start'),
    getStatus: () => api.get('/session/status'),
    disconnect: () => api.post('/session/disconnect'),
};

export const tweets = {
    post: (text: string, media_path?: string) => api.post('/tweets', { text, media_path }),
    delete: (tweet_id: string) => api.delete(`/tweets/${tweet_id}`),
    retweet: (tweet_url: string, quote_text?: string) =>
        api.post('/interactions/retweet', { tweet_url, quote_text }),
};

export const profile = {
    get: (handle: string) => api.get(`/profile/${handle}`),
};

export default api;
