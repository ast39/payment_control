import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Save, CreditCard } from 'lucide-react';

interface Payment {
  id: number;
  title: string;
  description?: string;
  amount: number;
  payment_date: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  end_date?: string;
}

interface PaymentModalProps {
  payment: Payment | null;
  onClose: () => void;
  onSaved: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ payment, onClose, onSaved }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    payment_date: '',
    due_date: '',
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    end_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!payment && payment.id;

    useEffect(() => {
    if (payment && payment.id) {
      setFormData({
        title: payment.title || '',
        description: payment.description || '',
        amount: payment.amount ? payment.amount.toString() : '',
        payment_date: payment.payment_date || '',
        due_date: payment.due_date || '',
        frequency: payment.frequency || 'once',
        end_date: payment.end_date || ''
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        title: '',
        description: '',
        amount: '',
        payment_date: today,
        due_date: today,
        frequency: 'once',
        end_date: ''
      });
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.amount || !formData.due_date) {
      setError('Заполните все обязательные поля');
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      setError('Сумма должна быть больше нуля');
      return;
    }

    if (formData.frequency !== 'once' && !formData.end_date) {
      setError('Для периодических платежей укажите дату окончания');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing && payment
        ? `http://localhost:3001/api/payments/${payment.id}`
        : 'http://localhost:3001/api/payments';
      
      const method = isEditing && payment ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          payment_date: formData.payment_date,
          due_date: formData.due_date,
          frequency: formData.frequency,
          end_date: formData.end_date || null
        })
      });

      if (response.ok) {
        onSaved();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка сохранения платежа:', error);
      setError('Не удалось сохранить платеж');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing && payment ? 'Редактировать платеж' : 'Создать платеж'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Название платежа *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="input"
              placeholder="Например: Аренда квартиры"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Описание
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="input min-h-[80px] resize-none"
              placeholder="Дополнительная информация о платеже (необязательно)"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Сумма (₽) *
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className="input"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
              Дата платежа *
            </label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => handleInputChange('due_date', e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-2">
              Периодичность
            </label>
            <select
              id="frequency"
              value={formData.frequency}
              onChange={(e) => handleInputChange('frequency', e.target.value)}
              className="input"
            >
              <option value="once">Однократно</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
              <option value="yearly">Ежегодно</option>
            </select>
          </div>

          {formData.frequency !== 'once' && (
            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                Дата окончания периода
              </label>
              <input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                className="input"
                min={formData.due_date}
              />
              <p className="mt-1 text-sm text-gray-500">
                Если не указать, платеж будет бессрочным
              </p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 inline-flex items-center justify-center"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              <span>{loading ? 'Сохранение...' : (isEditing && payment ? 'Обновить' : 'Создать')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
