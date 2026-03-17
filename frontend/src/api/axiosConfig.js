import axios from 'axios';

const api = axios.create({
    // Use Vite's native PROD boolean to strictly check deployment
    baseURL: import.meta.env.PROD 
        ? import.meta.env.VITE_BACKEND_URL 
        : "http://localhost:3000",

    withCredentials: true,

    headers: {
        'Content-Type': 'application/json',
    }
});

export default api;