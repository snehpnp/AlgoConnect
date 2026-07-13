import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export type UserRole = 'System Admin' | 'Growth Operator' | 'Compliance Admin' | 'Sales Rep';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  updateUserContext: (updates: Partial<User>) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from HTTP-only cookie by checking with backend
    const checkAuth = async () => {
      try {
        const response = await authService.me();
        if (response.user) {
          setUser({
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role as UserRole,
            avatar: response.user.avatar,
          });
        }
      } catch (error) {
        // Not authenticated or session expired
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      
      const userData: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role as UserRole,
        avatar: response.user.avatar,
      };
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserContext = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, updateUserContext, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
