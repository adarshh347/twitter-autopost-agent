
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

// Curator API for aesthetic tweet curation
export const curator = {
    // Get all tweet families
    getFamilies: () => api.get('/curator/families'),

    // Get archetypes, optionally filtered by family
    getArchetypes: (familyId?: string) =>
        api.get('/curator/archetypes', { params: { family_id: familyId } }),

    // Analyze an image (base64)
    analyzeImage: (imageBase64: string, skipLlmAnalysis: boolean = false) =>
        api.post('/curator/analyze', {
            image_base64: imageBase64,
            skip_llm_analysis: skipLlmAnalysis
        }),

    // Analyze uploaded image file
    analyzeUpload: async (file: File, skipLlmAnalysis: boolean = false) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('skip_llm_analysis', skipLlmAnalysis.toString());
        return api.post('/curator/analyze/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Generate tweet for analyzed image
    generateTweet: (imageId: string, familyId?: string, archetypeId?: string, customPrompt?: string) =>
        api.post('/curator/generate', {
            image_id: imageId,
            family_id: familyId,
            archetype_id: archetypeId,
            custom_prompt: customPrompt,
        }),

    // Get gallery of analyzed images
    getGallery: (limit: number = 50) =>
        api.get('/curator/gallery', { params: { limit } }),

    // Get generated tweets history
    getGeneratedTweets: (limit: number = 20) =>
        api.get('/curator/generated', { params: { limit } }),

    // Post a curated tweet
    postTweet: (imageId: string, tweetText: string, familyId: string, archetypeId: string) =>
        api.post('/curator/post', null, {
            params: { image_id: imageId, tweet_text: tweetText, family_id: familyId, archetype_id: archetypeId }
        }),

    // Post from Cloudinary gallery
    postFromGallery: (publicId: string, tweetText: string, familyId: string, archetypeId: string, deleteAfterPost: boolean = true) =>
        api.post('/curator/post-from-gallery', null, {
            params: {
                public_id: publicId,
                tweet_text: tweetText,
                family_id: familyId,
                archetype_id: archetypeId,
                delete_after_post: deleteAfterPost
            }
        }),
};

// Cloudinary Gallery API
export const gallery = {
    // Get images from Cloudinary gallery
    getImages: (maxResults: number = 50, nextCursor?: string) =>
        api.get('/gallery/images', { params: { max_results: maxResults, next_cursor: nextCursor } }),

    // Upload image to gallery
    upload: async (file: File, tags?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (tags) formData.append('tags', tags);
        return api.post('/gallery/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Delete image from gallery
    delete: (publicId: string) =>
        api.delete(`/gallery/images/${encodeURIComponent(publicId)}`),
};

export default api;
