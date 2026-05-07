import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/api';

interface User {
  id: string;
  email: string;
  role: string;
  organization?: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEMO_USER_KEY = 'satyam.demo.user';

const demoUsers: Record<string, User & { password: string }> = {
  'officer1@crpf.gov.in': {
    id: '1',
    email: 'officer1@crpf.gov.in',
    password: 'password123',
    role: 'committee_member',
    organization: 'CRPF',
    full_name: 'Rajesh Kumar',
  },
  'officer@crpf.gov.in': {
    id: '1',
    email: 'officer1@crpf.gov.in',
    password: 'password123',
    role: 'committee_member',
    organization: 'CRPF',
    full_name: 'Rajesh Kumar',
  },
  'admin@crpf.gov.in': {
    id: '3',
    email: 'admin@crpf.gov.in',
    password: 'password123',
    role: 'admin',
    organization: 'CRPF',
    full_name: 'Satyam Admin',
  },
  'bidder1@example.com': {
    id: '2',
    email: 'bidder1@example.com',
    password: 'password123',
    role: 'bidder',
    organization: 'ABC Corp',
    full_name: 'Suresh Sharma',
  },
};

const findDemoUser = (email: string, password: string) => {
  const user = demoUsers[email.trim().toLowerCase()];
  if (!user || user.password !== password) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        if (storedToken.startsWith('demo-token:')) {
          const storedUser = localStorage.getItem(DEMO_USER_KEY);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
            setIsLoading(false);
            return;
          }
        }

        try {
          // Validate token and get user info
          const userData = await authService.getCurrentUser(storedToken);
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem(DEMO_USER_KEY);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      const { access_token } = response;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // Get user details
      const userData = await authService.getCurrentUser(access_token);
      setUser(userData);
      localStorage.removeItem(DEMO_USER_KEY);
      return userData;
    } catch (error) {
      const demoUser = findDemoUser(email, password);
      if (!demoUser) {
        throw error;
      }

      const demoToken = `demo-token:${demoUser.role}:${demoUser.id}`;
      localStorage.setItem('token', demoToken);
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);
      return demoUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(DEMO_USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isLoading,
      isAuthenticated: !!token && !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
