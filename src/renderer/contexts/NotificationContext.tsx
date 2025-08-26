import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification, { NotificationType } from '../components/Notification';

interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => string;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => '',
  dismissNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showNotification = (
    type: NotificationType,
    message: string,
    duration: number = 5000
  ): string => {
    const id = Math.random().toString(36).substr(2, 9);
    
    setNotifications(prevNotifications => [
      ...prevNotifications,
      { id, type, message, duration }
    ]);
    
    return id;
  };

  const dismissNotification = (id: string) => {
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== id)
    );
  };

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
      <div className="fixed bottom-4 right-4 z-50 max-w-md">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            type={notification.type}
            message={notification.message}
            duration={notification.duration}
            onDismiss={() => dismissNotification(notification.id)}
          />
        ))}
      </div>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;