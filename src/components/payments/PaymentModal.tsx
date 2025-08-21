import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Save, CreditCard } from 'lucide-react';

interface Payment {
  id: number;
  title: string;
  description?: string;
  amount: number;
  currency_id?: number;
  category_id?: number;
  payment_method_id?: number;
  payment_date?: string;
  due_date: string;
  color?: string; // Добавляется динамически в роуте dashboard
}

interface Currency {
  id: number;
  name: string;
  code: string;
  symbol: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
}

interface PaymentMethod {
  id: number;
  name: string;
}

interface PaymentModalProps {
  payment: Payment | null;
  onClose: () => void;
  onSaved: () => void;
  initialDueDate?: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ payment, onClose, onSaved, initialDueDate }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    currency_id: '',
    category_id: '',
    payment_method_id: '',
    payment_date: '',
    due_date: ''
  });
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!payment && payment.id;

  // Загружаем справочники
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [currenciesRes, categoriesRes, paymentMethodsRes] = await Promise.all([
          fetch('http://localhost:3001/api/currencies', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('http://localhost:3001/api/categories', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('http://localhost:3001/api/payment-methods', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (currenciesRes.ok) {
          const currenciesData = await currenciesRes.json();
          setCurrencies(currenciesData);
        }
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
        if (paymentMethodsRes.ok) {
          const paymentMethodsData = await paymentMethodsRes.json();
          setPaymentMethods(paymentMethodsData);
        }
      } catch (error) {
        console.error('Ошибка загрузки справочников:', error);
      }
    };

    fetchData();
  }, [token]);

  useEffect(() => {
    if (payment && payment.id) {
      setFormData({
        title: payment.title || '',
        description: payment.description || '',
        amount: payment.amount ? payment.amount.toString() : '',
        currency_id: payment.currency_id ? payment.currency_id.toString() : '1',
        category_id: payment.category_id ? payment.category_id.toString() : '1',
        payment_method_id: payment.payment_method_id ? payment.payment_method_id.toString() : '1',
        payment_date: payment.payment_date || '',
        due_date: payment.due_date || ''
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        title: '',
        description: '',
        amount: '',
        currency_id: '1',
        category_id: '1',
        payment_method_id: '1',
        payment_date: '',
        due_date: initialDueDate || today
      });
    }
  }, [payment, initialDueDate]);

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

    // Убрана валидация frequency

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
          description: formData.description || null,
          amount: parseFloat(formData.amount),
          currency_id: parseInt(formData.currency_id),
          category_id: parseInt(formData.category_id),
          payment_method_id: parseInt(formData.payment_method_id),
          payment_date: formData.payment_date || null,
          due_date: formData.due_date
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
              Сумма *
            </label>
            <div className="flex space-x-3">
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="input flex-1"
                placeholder="0.00"
                required
              />
              <select
                value={formData.currency_id}
                onChange={(e) => handleInputChange('currency_id', e.target.value)}
                className="input w-32"
                required
              >
                {currencies.map(currency => (
                  <option key={currency.id} value={currency.id}>
                    {currency.symbol} {currency.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
              Категория *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => handleInputChange('category_id', e.target.value)}
              className="input"
              required
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment_method_id" className="block text-sm font-medium text-gray-700 mb-2">
              Способ оплаты *
            </label>
            <select
              value={formData.payment_method_id}
              onChange={(e) => handleInputChange('payment_method_id', e.target.value)}
              className="input"
              required
            >
              {paymentMethods.map(method => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
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

          {/* Убрано поле end_date */}

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
