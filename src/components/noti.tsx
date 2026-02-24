import { useNotificationStore } from '../store/notificationStore';

const TestButton = () => {
  const handleTest = () => {
    useNotificationStore.getState().testEmailNotification();
  };

  return <button onClick={handleTest}>Test Email</button>;
};