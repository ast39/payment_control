import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Settings as SettingsIcon, 
  Bell, 
  MessageCircle, 
  CheckCircle,
  AlertCircle,
  Play
} from 'lucide-react';
import PushNotifications from '../PushNotifications';

interface UserSettings {
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  reminder_days: number;
}

const Settings: React.FC = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    telegram_bot_token: null,
    telegram_chat_id: null,
    reminder_days: 3
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
      setMessage({ type: 'error', text: 'Не удалось загрузить настройки' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);



  const handleSave = async () => {
    if (!token) return;

    try {
      setSaving(true);
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Настройки сохранены успешно' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Ошибка сохранения' });
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      setMessage({ type: 'error', text: 'Не удалось сохранить настройки' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!token || !settings.telegram_chat_id) {
      setMessage({ type: 'error', text: 'Сначала укажите Chat ID Telegram' });
      return;
    }

    try {
      setTestLoading(true);
      const response = await fetch('http://localhost:3001/api/settings/test-telegram', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Тестовое уведомление отправлено!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Ошибка отправки' });
      }
    } catch (error) {
      console.error('Ошибка тестирования уведомления:', error);
      setMessage({ type: 'error', text: 'Не удалось отправить тестовое уведомление' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleRunNotifications = async () => {
    if (!token || !settings.telegram_chat_id) {
      setMessage({ type: 'error', text: 'Сначала укажите Chat ID Telegram' });
      return;
    }

    try {
      setRunLoading(true);
      const response = await fetch('http://localhost:3001/api/settings/run-notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Проверка выполнена! ${data.result.message}` 
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Ошибка выполнения' });
      }
    } catch (error) {
      console.error('Ошибка запуска уведомлений:', error);
      setMessage({ type: 'error', text: 'Не удалось запустить проверку уведомлений' });
    } finally {
      setRunLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center space-x-3">
        <SettingsIcon className="w-8 h-8 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
      </div>

      {/* Сообщения */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-success-50 border-success-200 text-success-800' 
            : 'bg-danger-50 border-danger-200 text-danger-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Настройки Telegram */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Telegram уведомления</h2>
            <p className="text-sm text-gray-600">
              Настройте уведомления о платежах в Telegram
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="telegram_bot_token" className="block text-sm font-medium text-gray-700 mb-2">
              Токен Telegram бота *
            </label>
            <input
              id="telegram_bot_token"
              type="text"
              value={settings.telegram_bot_token || ''}
              onChange={(e) => handleInputChange('telegram_bot_token', e.target.value)}
              className="input"
              placeholder="Например: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Получите токен у @BotFather в Telegram
            </p>
          </div>

          <div>
            <label htmlFor="telegram_chat_id" className="block text-sm font-medium text-gray-700 mb-2">
              Chat ID Telegram *
            </label>
            <div className="flex space-x-3">
              <input
                id="telegram_chat_id"
                type="text"
                value={settings.telegram_chat_id || ''}
                onChange={(e) => handleInputChange('telegram_chat_id', e.target.value)}
                className="input flex-1"
                placeholder="Например: 123456789"
                required
              />
              <button
                onClick={handleTestNotification}
                disabled={testLoading || !settings.telegram_bot_token || !settings.telegram_chat_id}
                className="btn-secondary whitespace-nowrap inline-flex items-center"
              >
                {testLoading ? (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    <span>Тест</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRunNotifications}
                disabled={runLoading || !settings.telegram_bot_token || !settings.telegram_chat_id}
                className="btn-primary whitespace-nowrap inline-flex items-center"
              >
                {runLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    <span>Запуск</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Чтобы получить Chat ID, отправьте сообщение боту @userinfobot в Telegram
            </p>
          </div>

          <div>
            <label htmlFor="reminder_days" className="block text-sm font-medium text-gray-700 mb-2">
              Напоминать за (дней)
            </label>
            <select
              id="reminder_days"
              value={settings.reminder_days}
              onChange={(e) => handleInputChange('reminder_days', parseInt(e.target.value))}
              className="input"
            >
              <option value={1}>1 день</option>
              <option value={2}>2 дня</option>
              <option value={3}>3 дня</option>
              <option value={5}>5 дней</option>
              <option value={7}>1 неделя</option>
              <option value={14}>2 недели</option>
              <option value={30}>1 месяц</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">
              За сколько дней до платежа отправлять уведомление
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full sm:w-auto inline-flex items-center"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <SettingsIcon className="w-4 h-4 mr-2" />
              )}
              <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Информация о настройках */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Как настроить Telegram уведомления
            </h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>1. Создайте бота через @BotFather в Telegram</p>
              <p>2. Получите токен бота (например: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)</p>
              <p>3. Найдите бота @userinfobot в Telegram</p>
              <p>4. Отправьте ему любое сообщение</p>
              <p>5. Бот ответит вам Chat ID (например: 123456789)</p>
              <p>6. Введите токен и Chat ID в поля выше</p>
              <p>7. Нажмите "Тест" для проверки подключения</p>
              <p>8. Нажмите "Запуск" для ручной проверки платежей и отправки уведомлений</p>
              <p>9. Сохраните настройки</p>
            </div>
          </div>
        </div>
      </div>

      {/* Push уведомления */}
      <div className="mt-6">
        <PushNotifications />
      </div>
    </div>
  );
};

export default Settings;
