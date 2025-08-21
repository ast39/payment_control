import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import PaymentModal from '../payments/PaymentModal';
import PaymentDetails from '../payments/PaymentDetails';

interface Payment {
  id: number;
  title: string;
  description?: string;
  amount: number;
  currency_id?: number;
  currency_name?: string;
  currency_code?: string;
  currency_symbol?: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  payment_method_id?: number;
  payment_method_name?: string;
  payment_date?: string;
  due_date: string;
  color?: string; // Добавляется динамически в роуте dashboard
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

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
        
        // Подсчитываем общее количество платежей в календаре
        let totalPaymentsInCalendar = 0;
        Object.values(processedCalendarData).forEach(dayPayments => {
          totalPaymentsInCalendar += dayPayments.length;
        });
        
        console.log('Обработанные данные календаря:', processedCalendarData);
        console.log('Общее количество платежей в календаре:', totalPaymentsInCalendar);
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

  const getDaysInMonth = (): (Date | null)[] => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Получаем день недели для первого дня месяца (0 = воскресенье, 1 = понедельник)
    const firstDayOfWeek = start.getDay();
    
    // Вычисляем сколько пустых дней нужно добавить в начале
    // В нашем календаре неделя начинается с понедельника (1), а не с воскресенья (0)
    let emptyDaysBefore = firstDayOfWeek - 1;
    if (emptyDaysBefore < 0) emptyDaysBefore = 6; // Если воскресенье, то добавляем 6 дней
    
    // Создаем массив дней месяца
    const monthDays = eachDayOfInterval({ start, end });
    
    // Добавляем пустые дни в начало для правильного выравнивания
    const result: (Date | null)[] = [];
    
    // Добавляем пустые дни в начале
    for (let i = 0; i < emptyDaysBefore; i++) {
      result.push(null);
    }
    
    // Добавляем дни месяца
    result.push(...monthDays);
    
    return result;
  };

  const getPaymentColorByColor = (color: string) => {
    switch (color) {
      case 'red': return 'bg-danger-500';
      case 'green': return 'bg-success-500';
      case 'yellow': return 'bg-warning-500';
      case 'blue': return 'bg-primary-500';
      default: return 'bg-primary-500';
    }
  };

  const handleDayClick = (day: Date) => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    setSelectedDate(formattedDate);
    setShowPaymentModal(true);
  };

  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);
    setSelectedDate('');
  };

  const handlePaymentSaved = () => {
    setShowPaymentModal(false);
    setSelectedDate('');
    fetchDashboardData(); // Перезагружаем данные
  };

  const handlePaymentClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetails(true);
  };

  const handlePaymentDetailsClose = () => {
    setShowPaymentDetails(false);
    setSelectedPayment(null);
  };

  const handlePaymentUpdated = () => {
    setShowPaymentDetails(false);
    setSelectedPayment(null);
    fetchDashboardData(); // Перезагружаем данные
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
          
          {/* Отладка календаря */}
          {(() => {
            const calendarDays = getDaysInMonth();
            const actualMonthDays = calendarDays.filter(day => day !== null).length;
            const totalPaymentsInCalendar = Object.values(calendarData).reduce((sum, dayPayments) => sum + dayPayments.length, 0);
            const daysWithPayments = Object.keys(calendarData).length;
            
            console.log('=== КАЛЕНДАРЬ ОТЛАДКА ===');
            console.log('Всего ячеек в календаре:', calendarDays.length);
            console.log('Фактических дней в месяце:', actualMonthDays);
            console.log('Дней с платежами:', daysWithPayments);
            console.log('Всего платежей в календаре:', totalPaymentsInCalendar);
            console.log('calendarData:', calendarData);
            console.log('========================');
            
            return (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="font-semibold text-gray-700">{actualMonthDays}</div>
                    <div className="text-gray-500">дней в месяце</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">{daysWithPayments}</div>
                    <div className="text-gray-500">дней с платежами</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">{totalPaymentsInCalendar}</div>
                    <div className="text-gray-500">платежей в календаре</div>
                  </div>
                </div>
              </div>
            );
          })()}

        <div className="grid grid-cols-7 gap-1">
          {/* Дни недели */}
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}

          {/* Дни месяца */}
          {getDaysInMonth().map((day, index) => {
            // Если день null (пустой день в начале месяца), рендерим пустую ячейку
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="p-2 min-h-[80px] border border-gray-200 bg-gray-50"
                >
                  {/* Пустая ячейка */}
                </div>
              );
            }

            const dayKey = format(day, 'd');
            const dayPayments = calendarData[dayKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            
            // Отладка рендеринга дней
            if (dayKey === '5' || dayKey === '7' || dayKey === '11') {
              console.log(`=== РЕНДЕРИНГ ДЕНЬ ${dayKey} ===`);
              console.log('day:', day);
              console.log('dayKey:', dayKey);
              console.log('dayPayments:', dayPayments);
              console.log('calendarData[dayKey]:', calendarData[dayKey]);
              console.log('isCurrentMonth:', isCurrentMonth);
              console.log('isCurrentDay:', isCurrentDay);
              console.log('day.toISOString():', day.toISOString());
              console.log('format(day, "d"):', format(day, 'd'));
              console.log('========================');
            }

            return (
              <div
                key={index}
                className={`p-2 min-h-[80px] border border-gray-200 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isCurrentDay ? 'ring-2 ring-primary-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-gray-900">
                    {format(day, 'd')}
                  </div>
                  {isCurrentMonth && (
                    <button
                      onClick={() => handleDayClick(day)}
                      className="w-5 h-5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors flex items-center justify-center"
                      title={`Создать платеж на ${format(day, 'dd.MM.yyyy', { locale: ru })}`}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
                
                {/* Платежи за день */}
                <div className="space-y-1">
                  {dayPayments.slice(0, 3).map((payment) => (
                    <div
                      key={payment.id}
                      className={`text-xs p-1 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity ${getPaymentColorByColor(payment.color || 'blue')}`}
                      title={`${payment.title} - ${payment.amount} ${payment.currency_symbol || '₽'} (клик для просмотра)`}
                      onClick={() => handlePaymentClick(payment)}
                    >
                      <div className="font-medium">{payment.title}</div>
                      <div className="text-xs opacity-90">{payment.amount} {payment.currency_symbol || '₽'}</div>
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
                  <span className="font-semibold text-blue-600">{payment.amount} {payment.currency_symbol || '₽'}</span>
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
                  <span className="font-semibold text-red-600">{payment.amount} {payment.currency_symbol || '₽'}</span>
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
                  <span className="font-semibold text-green-600">{payment.amount} {payment.currency_symbol || '₽'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Нет исполненных платежей</p>
          )}
        </div>
      </div>

      {/* Модальное окно создания платежа */}
      {showPaymentModal && (
        <PaymentModal
          payment={null}
          onClose={handlePaymentModalClose}
          onSaved={handlePaymentSaved}
          initialDueDate={selectedDate}
        />
      )}

      {/* Модальное окно деталей платежа */}
      {showPaymentDetails && selectedPayment && (
        <PaymentDetails
          payment={selectedPayment}
          onClose={handlePaymentDetailsClose}
          onUpdated={handlePaymentUpdated}
        />
      )}
    </div>
  );
};

export default Dashboard;
