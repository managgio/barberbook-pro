import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/data/types';
import { users } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'barberia-auth';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setUser(data.user);
      } catch (e) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = (user: User) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      user,
      token: `mock-token-${user.id}`,
    }));
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Find user by email (mock auth - in real app, validate password)
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!foundUser) {
      return { success: false, error: 'Usuario no encontrado. Verifica tu email.' };
    }
    
    // Mock password validation (accept any password for demo)
    setUser(foundUser);
    saveSession(foundUser);
    return { success: true };
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    // Simulate Google OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // For demo, login as first client user
    const clientUser = users.find(u => u.role === 'client');
    if (clientUser) {
      setUser(clientUser);
      saveSession(clientUser);
      return { success: true };
    }
    
    return { success: false, error: 'Error al conectar con Google' };
  };

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if email already exists
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return { success: false, error: 'Este email ya está registrado.' };
    }
    
    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role: 'client',
      notificationPrefs: { email: true, whatsapp: false },
      adminRoleId: null,
    };
    
    users.push(newUser);
    setUser(newUser);
    saveSession(newUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      saveSession(updated);
      
      // Update in mock data
      const index = users.findIndex(u => u.id === user.id);
      if (index !== -1) {
        users[index] = updated;
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
      signup,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
