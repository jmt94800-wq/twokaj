import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLocalUser, setLocalUser as saveLocalUser } from './services/db';

interface AuthContextType {
  user: any | null;
  login: (userData: any) => void;
  logout: () => void;
  isOffline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load user from local storage/IndexedDB
    getLocalUser().then(u => {
      if (u) setUser(u);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const login = (userData: any) => {
    setUser(userData);
    saveLocalUser(userData);
  };

  const logout = () => {
    setUser(null);
    saveLocalUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isOffline }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
