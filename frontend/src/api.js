import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_URL });

export const analyzeReport = (payload) => api.post('/analyze', payload).then((r) => r.data);
export const fetchGraph = () => api.get('/graph').then((r) => r.data);
export const fetchPeople = () => api.get('/people').then((r) => r.data);
export const fetchCases = () => api.get('/cases').then((r) => r.data);
export const createCase = (payload) => api.post('/cases', payload).then((r) => r.data);
export const fetchReports = () => api.get('/reports').then((r) => r.data);
