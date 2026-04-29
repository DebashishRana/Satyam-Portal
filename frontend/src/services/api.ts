import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Add request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  },

  register: async (userData: any) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
};

// Tender Service
export const tenderService = {
  getAll: async (params?: { status?: string; category?: string }) => {
    const response = await apiClient.get('/tenders/', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/tenders/${id}`);
    return response.data;
  },

  create: async (tenderData: any) => {
    const response = await apiClient.post('/tenders/', tenderData);
    return response.data;
  },

  publish: async (id: string) => {
    const response = await apiClient.post(`/tenders/${id}/publish`);
    return response.data;
  },

  getSummary: async (id: string) => {
    const response = await apiClient.get(`/tenders/${id}/summary`);
    return response.data;
  },
};

// Document Service
export const documentService = {
  upload: async (file: File, metadata?: any) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response = await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/documents/${id}`);
    return response.data;
  },

  list: async (params?: any) => {
    const response = await apiClient.get('/documents/', { params });
    return response.data;
  },

  process: async (id: string) => {
    const response = await apiClient.post(`/documents/${id}/process`);
    return response.data;
  },
};

// Bidder Service
export const bidderService = {
  submitBid: async (tenderId: string, submissionData: any) => {
    const response = await apiClient.post(`/bidders/${tenderId}/submit`, submissionData);
    return response.data;
  },

  getSubmissionStatus: async (submissionId: string) => {
    const response = await apiClient.get(`/bidders/submissions/${submissionId}/status`);
    return response.data;
  },

  getMySubmissions: async () => {
    const response = await apiClient.get('/bidders/my-submissions');
    return response.data;
  },
};

// Evaluation Service
export const evaluationService = {
  evaluateBidder: async (tenderId: string, bidderId: string) => {
    const response = await apiClient.post(`/evaluation/${tenderId}/evaluate/${bidderId}`);
    return response.data;
  },

  getComparison: async (tenderId: string) => {
    const response = await apiClient.get(`/evaluation/${tenderId}/comparison`);
    return response.data;
  },

  getVerificationCard: async (evaluationId: string, criterionId: string) => {
    const response = await apiClient.get(`/evaluation/${evaluationId}/verification-card/${criterionId}`);
    return response.data;
  },

  overrideCriterion: async (evaluationId: string, criterionId: string, newStatus: string, comment: string) => {
    const response = await apiClient.post(`/evaluation/${evaluationId}/override/${criterionId}`, null, {
      params: { new_status: newStatus, comment }
    });
    return response.data;
  },

  getReport: async (evaluationId: string) => {
    const response = await apiClient.get(`/evaluation/${evaluationId}/report`);
    return response.data;
  },
};

export default apiClient;
