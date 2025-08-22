import React, { useState } from 'react';
import { X, Save, CreditCard } from 'lucide-react';

interface QuickPayModalProps {
  payment: {
    id: number;
    title: string;
    amount: number;
  };
  onClose: () => void;
  onSubmit: (amount: number, paymentDate: string) => void;
}

const QuickPayModal: React.FC<QuickPayModalProps> = ({ payment, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    amount_paid: payment.amount.toString(),
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.amount_paid || parseFloat(formData.amount_paid) <= 0) {
      setError('Сумма должна быть больше нуля');
      return;
    }

    if (!formData.payment_date) {
      setError('Укажите дату оплаты');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(parseFloat(formData.amount_paid), formData.payment_date);
    } catch (error) {
      setError('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-success-600" />
            <h2 className="text-lg font-semibold text-gray-900">Отметить как оплаченный</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Платеж
            </label>
            <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
              {payment.title}
            </div>
          </div>

          <div>
            <label htmlFor="amount_paid" className="block text-sm font-medium text-gray-700 mb-2">
              Сумма оплаты *
            </label>
            <input
              type="number"
              id="amount_paid"
              step="0.01"
              min="0.01"
              value={formData.amount_paid}
              onChange={(e) => setFormData(prev => ({ ...prev, amount_paid: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700 mb-2">
              Дата оплаты *
            </label>
            <input
              type="date"
              id="payment_date"
              value={formData.payment_date}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="text-danger-600 text-sm bg-danger-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary inline-flex items-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickPayModal;
