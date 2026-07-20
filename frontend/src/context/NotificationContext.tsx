import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiClient } from '../services/apiClient';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedEntityId: number | null;
  relatedEntity: string | null;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch initial notifications
  useEffect(() => {
    if (user) {
      apiClient.get('/notifications').then((res: any) => {
        setNotifications(res.data);
      }).catch(console.error);
    }
  }, [user]);

  // Setup Socket.io connection
  useEffect(() => {
    if (user) {
      const isLocalhost = window.location.hostname === 'localhost';
      const backendUrl = isLocalhost ? 'http://localhost:7701' : window.location.origin;
      const socketPath = isLocalhost ? '/socket.io' : '/backend1/socket.io';

      const newSocket = io(backendUrl, {
        path: socketPath,
        withCredentials: true,
      });

      newSocket.on('connect', () => {
        // console.log('[Socket] Connected to server');
        newSocket.emit('register', user.id);
      });

      newSocket.on('new_notification', (notif: Notification) => {
        setNotifications(prev => [notif, ...prev]);

        // Optional: Trigger a browser/toast notification here
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await apiClient.put('/notifications/read-all');
    } catch (e) {
      console.error(e);
    }
  };

  const clearAll = async () => {
    setNotifications([]);
    try {
      await apiClient.delete('/notifications/clear');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
