import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle } from 'lucide-react';

const PushNotifications: React.FC = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    // Проверяем поддержку push уведомлений
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        setIsSubscribed(true);
        setSubscription(existingSubscription);
      }
    } catch (error) {
      console.error('Ошибка при проверке подписки:', error);
    }
  };

  const subscribeToNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Запрашиваем разрешение на уведомления
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Подписываемся на push уведомления
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
        });
        
        setIsSubscribed(true);
        setSubscription(newSubscription);
        
        // Отправляем подписку на сервер
        await sendSubscriptionToServer(newSubscription);
        
        console.log('Подписка на push уведомления успешна');
      } else {
        console.log('Разрешение на уведомления не получено');
      }
    } catch (error) {
      console.error('Ошибка при подписке на уведомления:', error);
    }
  };

  const unsubscribeFromNotifications = async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        setSubscription(null);
        
        // Удаляем подписку с сервера
        await removeSubscriptionFromServer(subscription);
        
        console.log('Отписка от push уведомлений успешна');
      }
    } catch (error) {
      console.error('Ошибка при отписке от уведомлений:', error);
    }
  };

  const sendSubscriptionToServer = async (sub: PushSubscription) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: sub.toJSON()
        })
      });
    } catch (error) {
      console.error('Ошибка при отправке подписки на сервер:', error);
    }
  };

  const removeSubscriptionFromServer = async (sub: PushSubscription) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: sub.toJSON()
        })
      });
    } catch (error) {
      console.error('Ошибка при удалении подписки с сервера:', error);
    }
  };

  const testNotification = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification('Тест уведомления', {
        body: 'Это тестовое push уведомление от приложения Payments Control',
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1
        }
      });
    } catch (error) {
      console.error('Ошибка при отправке тестового уведомления:', error);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <BellOff size={20} />
          <span className="text-sm font-medium">
            Push уведомления не поддерживаются в вашем браузере
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-full ${isSubscribed ? 'bg-green-100' : 'bg-gray-100'}`}>
          {isSubscribed ? (
            <CheckCircle size={20} className="text-green-600" />
          ) : (
            <Bell size={20} className="text-gray-600" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Push уведомления</h3>
          <p className="text-sm text-gray-600">
            {isSubscribed 
              ? 'Вы подписаны на уведомления о платежах'
              : 'Подпишитесь на уведомления о платежах'
            }
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {!isSubscribed ? (
          <button
            onClick={subscribeToNotifications}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Bell size={16} />
            Подписаться на уведомления
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={unsubscribeFromNotifications}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <BellOff size={16} />
              Отписаться от уведомлений
            </button>
            
            <button
              onClick={testNotification}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Тест уведомления
            </button>
          </div>
        )}
      </div>

      {isSubscribed && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✅ Вы будете получать уведомления о:
          </p>
          <ul className="text-sm text-green-700 mt-2 space-y-1">
            <li>• Просроченных платежах</li>
            <li>• Напоминаниях о предстоящих платежах</li>
            <li>• Обновлениях приложения</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PushNotifications;
