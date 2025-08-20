import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  CheckCircle,
  Clock,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import PaymentModal from './PaymentModal';
import PaymentDetails from './PaymentDetails';

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
  payment_count?: number;
  total_paid?: number;
}

const Payments: React.FC = () => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchPayments = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/payments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки платежей:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [token]);

  const handleCreatePayment = () => {
    setEditingPayment(null);
    setShowModal(true);
  };

  const handleEditPayment = (payment: Payment) => {
    if (payment && payment.id) {
      setEditingPayment(payment);
      setShowModal(true);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!token || !window.confirm('Вы уверены, что хотите удалить этот платеж?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/payments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchPayments();
      }
    } catch (error) {
      console.error('Ошибка удаления платежа:', error);
    }
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetails(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingPayment(null);
  };

  const handlePaymentSaved = () => {
    fetchPayments();
    handleModalClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-success-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-danger-600" />;
      default:
        return <Clock className="w-4 h-4 text-warning-600" />;
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

  const getFrequencyText = (frequency: string) => {
    const frequencyMap = {
      once: 'Однократно',
      daily: 'Ежедневно',
      weekly: 'Еженедельно',
      monthly: 'Ежемесячно',
      yearly: 'Ежегодно'
    };
    return frequencyMap[frequency as keyof typeof frequencyMap] || frequency;
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Платежи</h1>
        <button
          onClick={handleCreatePayment}
          className="btn-primary inline-flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Создать платеж</span>
        </button>
      </div>

      {/* Список платежей */}
      <div className="card">
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата платежа
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Периодичность
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.title}
                          </div>
                          {payment.status === 'paid' && payment.payment_count && payment.payment_count > 0 && (
                            <div className="text-sm text-gray-500">
                              Оплачено: {payment.payment_count} раз
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.amount} ₽
                      </div>
                      {payment.status === 'paid' && payment.total_paid && payment.total_paid > 0 && (
                        <div className="text-sm text-gray-500">
                          Оплачено: {payment.total_paid} ₽
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(payment.due_date), 'dd.MM.yyyy', { locale: ru })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(payment.status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {payment.status === 'pending' ? 'Ожидает' : 
                           payment.status === 'paid' ? 'Оплачен' : 'Просрочен'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getFrequencyText(payment.frequency)}
                      </div>
                      {payment.end_date && (
                        <div className="text-sm text-gray-500">
                          До {format(new Date(payment.end_date), 'dd.MM.yyyy', { locale: ru })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(payment)}
                          className="text-primary-600 hover:text-primary-900 p-1"
                          title="Просмотр деталей"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="text-warning-600 hover:text-warning-900 p-1"
                          title="Редактировать"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-danger-600 hover:text-danger-900 p-1"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет платежей</h3>
            <p className="mt-1 text-sm text-gray-500">
              Создайте первый платеж, чтобы начать отслеживать ваши расходы.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreatePayment}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span>Создать платеж</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {showModal && (
        <PaymentModal
          payment={editingPayment}
          onClose={handleModalClose}
          onSaved={handlePaymentSaved}
        />
      )}

      {/* Модальное окно деталей */}
      {showDetails && selectedPayment && (
        <PaymentDetails
          payment={selectedPayment}
          onClose={() => setShowDetails(false)}
          onUpdated={fetchPayments}
        />
      )}
    </div>
  );
};

export default Payments;
