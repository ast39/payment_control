import React, { useState, useEffect } from 'react';
import { Download, X, CheckCircle, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../hooks/useServiceWorker';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { isOffline, isUpdateAvailable, updateApp } = useServiceWorker();

  useEffect(() => {
    // Проверяем, установлено ли уже приложение
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Проверяем поддержку PWA
    const isPWAInstallable = 'serviceWorker' in navigator && 'PushManager' in window;
    
    let handleBeforeInstallPrompt: ((e: Event) => void) | null = null;
    let handleAppInstalled: (() => void) | null = null;
    
    if (isPWAInstallable) {
      // Слушаем событие beforeinstallprompt (Chrome, Edge)
      handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowInstallButton(true);
      };

      // Слушаем событие appinstalled
      handleAppInstalled = () => {
        setIsInstalled(true);
        setShowInstallButton(false);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    // Слушаем изменения онлайн статуса
    const handleOnline = () => {};
    const handleOffline = () => {};

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Показываем кнопку установки для всех браузеров через 3 секунды
    const timer = setTimeout(() => {
      if (!isInstalled && isPWAInstallable) {
        setShowInstallButton(true);
      }
    }, 3000);

    return () => {
      if (isPWAInstallable && handleBeforeInstallPrompt && handleAppInstalled) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Пользователь принял установку PWA');
    } else {
      console.log('Пользователь отклонил установку PWA');
    }
    
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
  };

  // Не показываем, если приложение уже установлено
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Индикатор оффлайн режима */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 px-4 z-50">
          <span className="text-sm font-medium">
            🔴 Работаете в оффлайн режиме
          </span>
        </div>
      )}

      {/* Уведомление об обновлении */}
      {isUpdateAvailable && (
        <div className="fixed top-0 left-0 right-0 bg-green-500 text-white text-center py-2 px-4 z-50">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-medium">
              🆕 Доступно обновление приложения
            </span>
            <button
              onClick={updateApp}
              className="bg-white text-green-600 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Обновить
            </button>
          </div>
        </div>
      )}

      {/* Кнопка установки PWA */}
      {showInstallButton && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Установить приложение</h3>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          <p className="text-xs text-gray-100 mb-3">
            Установите приложение для быстрого доступа и работы оффлайн
          </p>
          
          {deferredPrompt ? (
            <button
              onClick={handleInstallClick}
              className="w-full bg-white text-blue-600 py-2 px-4 rounded-md font-medium text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Установить
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-yellow-200 font-medium">Инструкции по установке:</p>
              <div className="text-xs text-gray-200 space-y-1">
                <p><strong>Chrome/Edge:</strong> Нажмите ⋮ → "Установить приложение"</p>
                <p><strong>Safari:</strong> Нажмите 📤 → "На экран «Домой»"</p>
                <p><strong>Mobile:</strong> Нажмите "Добавить на главный экран"</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PWAInstaller;
