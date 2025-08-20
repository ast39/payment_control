import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Payment {
  id: number;
  title: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  color: string;
}

interface DashboardStats {
  total_payments: number;
  pending_payments: number;
  paid_payments: number;
  overdue_payments: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  overdue_amount: number;
}

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, Payment[]>>({});
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [overduePayments, setOverduePayments] = useState<Payment[]>([]);
  const [completedPayments, setCompletedPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');

      // Получаем данные календаря
      const calendarResponse = await fetch(
        `http://localhost:3001/api/dashboard/calendar/${year}/${month}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (calendarResponse.ok) {
        const rawCalendarData = await calendarResponse.json();
        console.log('Получены данные календаря:', rawCalendarData);
        
        // Преобразуем данные в объект по дням
        let processedCalendarData: { [key: string]: any[] } = {};
        
        // Проверяем что пришло и обрабатываем соответственно
        if (Array.isArray(rawCalendarData)) {
          // Если это массив платежей
          rawCalendarData.forEach((payment: any) => {
            const day = payment.due_date.split('-')[2]; // Получаем день из даты
            if (!processedCalendarData[day]) {
              processedCalendarData[day] = [];
            }
            processedCalendarData[day].push(payment);
          });
        } else if (typeof rawCalendarData === 'object' && rawCalendarData !== null) {
          // Если это уже объект по дням
          processedCalendarData = rawCalendarData;
        } else {
          console.error('Неожиданный формат данных календаря:', rawCalendarData);
        }
        
        console.log('Обработанные данные календаря:', processedCalendarData);
        console.log('Устанавливаем calendarData:', processedCalendarData);
        setCalendarData(processedCalendarData);
      } else {
        console.error('Ошибка получения календаря:', calendarResponse.status);
      }

      // Получаем статистику
      const statsResponse = await fetch(
        `http://localhost:3001/api/dashboard/stats?year=${year}&month=${month}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data.stats);
        setUpcomingPayments(data.upcoming_payments);
        setOverduePayments(data.overdue_payments);
        setCompletedPayments(data.completed_payments || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getPaymentColor = (status: string, dueDate: string) => {
    if (status === 'paid') return 'bg-success-500';
    if (status === 'overdue') return 'bg-danger-500';
    
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 5 && diffDays >= 0) return 'bg-warning-500';
    return 'bg-primary-500';
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
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <button
          onClick={goToToday}
          className="btn-secondary inline-flex items-center"
        >
          <span>Сегодня</span>
        </button>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Всего платежей • {stats.total_payments}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_amount} ₽</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Clock className="w-6 h-6 text-warning-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ожидают оплаты • {stats.pending_payments}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending_amount || 0} ₽</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Оплачено • {stats.paid_payments}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.paid_amount} ₽</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-danger-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-danger-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Просрочено • {stats.overdue_payments}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.overdue_amount || 0} ₽</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Календарь */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Календарь платежей</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              ←
            </button>
            <span className="text-lg font-medium text-gray-900">
              {format(currentDate, 'MMMM yyyy', { locale: ru })}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {/* Дни недели */}
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}

          {/* Дни месяца */}
          {getDaysInMonth().map((day, index) => {
            const dayKey = format(day, 'd');
            const dayPayments = calendarData[dayKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            
                    // Отладка для конкретного дня
        if (dayKey === '1' && isCurrentMonth) {
          console.log(`День ${dayKey}:`, dayPayments);
          console.log(`calendarData для дня ${dayKey}:`, calendarData[dayKey]);
        }

            return (
              <div
                key={index}
                className={`p-2 min-h-[80px] border border-gray-200 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isCurrentDay ? 'ring-2 ring-primary-500' : ''}`}
              >
                <div className="text-sm text-gray-900 mb-1">
                  {format(day, 'd')}
                </div>
                
                {/* Платежи за день */}
                <div className="space-y-1">
                  {dayPayments.slice(0, 3).map((payment) => (
                    <div
                      key={payment.id}
                      className={`text-xs p-1 rounded truncate text-white ${getPaymentColor(payment.status, payment.due_date)}`}
                      title={`${payment.title} - ${payment.amount} ₽`}
                    >
                      <div className="font-medium">{payment.title}</div>
                      <div className="text-xs opacity-90">{payment.amount} ₽</div>
                    </div>
                  ))}
                  {dayPayments.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayPayments.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Блоки с платежами */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ближайшие платежи (сегодня + 1 месяц) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ближайшие платежи</h3>
          <p className="text-sm text-gray-600 mb-3">Сегодня + 1 месяц</p>
          {upcomingPayments.length > 0 ? (
            <div className="space-y-3">
              {upcomingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{payment.title}</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(payment.due_date), 'dd MMMM yyyy', { locale: ru })}
                    </p>
                  </div>
                  <span className="font-semibold text-blue-600">{payment.amount} ₽</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Нет предстоящих платежей</p>
          )}
        </div>

        {/* Просроченные платежи (этот месяц) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Просроченные платежи</h3>
          <p className="text-sm text-gray-600 mb-3">Этот месяц</p>
          {overduePayments.length > 0 ? (
            <div className="space-y-3">
              {overduePayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{payment.title}</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(payment.due_date), 'dd MMMM yyyy', { locale: ru })}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600">{payment.amount} ₽</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Нет просроченных платежей</p>
          )}
        </div>

        {/* Исполненные платежи (этот месяц) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Исполненные платежи</h3>
          <p className="text-sm text-gray-600 mb-3">Этот месяц</p>
          {completedPayments.length > 0 ? (
            <div className="space-y-3">
              {completedPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{payment.title}</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(payment.due_date), 'dd MMMM yyyy', { locale: ru })}
                    </p>
                  </div>
                  <span className="font-semibold text-green-600">{payment.amount} ₽</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Нет исполненных платежей</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
