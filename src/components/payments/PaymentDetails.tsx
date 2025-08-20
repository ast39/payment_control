import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, 
  CreditCard, 
  Calendar, 
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Убран интерфейс PaymentHistory

interface Payment {
  id: number;
  title: string;
  description?: string;
  amount: number;
  payment_date?: string;
  due_date: string;
}

interface PaymentDetailsProps {
  payment: Payment;
  onClose: () => void;
  onUpdated: () => void;
}

const PaymentDetails: React.FC<PaymentDetailsProps> = ({ payment, onClose, onUpdated }) => {
  const { token } = useAuth();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: payment.amount.toString(),
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPaymentStatus = (payment: Payment) => {
    if (payment.payment_date) {
      return 'paid';
    }
    const dueDate = new Date(payment.due_date);
    const now = new Date();
    if (dueDate < now) {
      return 'overdue';
    }
    return 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-success-600" />;
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-danger-600" />;
      default:
        return <Clock className="w-5 h-5 text-warning-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-success-100 text-success-800';
      case 'overdue':
        return 'bg-danger-100 text-danger-800';
      default:
        return 'bg-warning-100 text-warning-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Оплачен';
      case 'overdue':
        return 'Просрочен';
      default:
        return 'Ожидает оплаты';
    }
  };

  const handleMarkAsPaid = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`http://localhost:3001/api/payments/${payment.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_paid: parseFloat(paymentForm.amount_paid),
          payment_date: paymentForm.payment_date
        })
      });

      if (response.ok) {
        onUpdated();
        onClose(); // Закрываем модалку после успешного сохранения
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка отметки платежа');
      }
    } catch (error) {
      console.error('Ошибка отметки платежа:', error);
      setError('Не удалось отметить платеж как оплаченный');
    } finally {
      setLoading(false);
    }
  };

  // Убраны переменные totalPaid и remainingAmount

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Детали платежа</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Основная информация */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Левая колонка */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{payment.title}</h3>
                {payment.description && payment.description.trim() !== '' && (
                  <p className="text-sm text-gray-600 mb-3">{payment.description}</p>
                )}
                <div className="flex items-center space-x-2">
                  {getStatusIcon(getPaymentStatus(payment))}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(getPaymentStatus(payment))}`}>
                    {getStatusText(getPaymentStatus(payment))}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Сумма:</span>
                  <span className="text-lg font-semibold text-gray-900">{payment.amount} ₽</span>
                </div>
                
                {/* Убраны поля totalPaid и remainingAmount */}
              </div>
            </div>

            {/* Правая колонка */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-600">Дата платежа</div>
                    <div className="text-sm font-medium text-gray-900">
                      {format(new Date(payment.due_date), 'dd MMMM yyyy', { locale: ru })}
                    </div>
                  </div>
                </div>

                {payment.payment_date && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-success-600" />
                    <div>
                      <div className="text-sm text-gray-600">Дата оплаты</div>
                      <div className="text-sm font-medium text-success-600">
                        {format(new Date(payment.payment_date), 'dd MMMM yyyy', { locale: ru })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Убрана периодичность */}

                {/* Убрана дата окончания */}
              </div>
            </div>
          </div>

          {/* Кнопка отметки как оплаченного */}
          {getPaymentStatus(payment) !== 'paid' && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowPaymentForm(true)}
                className="btn-success w-full inline-flex items-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>Отметить как оплаченный</span>
              </button>
            </div>
          )}

          {/* Форма отметки оплаты */}
          {showPaymentForm && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Отметить оплату</h4>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма оплаты
                  </label>
                                      <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentForm.amount_paid}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount_paid: e.target.value }))}
                      className="input"
                      placeholder="0.00"
                    />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата оплаты
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button
                  onClick={handleMarkAsPaid}
                  disabled={loading}
                  className="btn-success inline-flex items-center"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
                </button>
              </div>
            </div>
          )}

          {/* История платежей убрана */}
        </div>
      </div>
    </div>
  );
};

export default PaymentDetails;
