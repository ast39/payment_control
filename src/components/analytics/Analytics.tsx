import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../../contexts/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Payment {
  id: number;
  amount: number;
  currency_code: string;
  currency_symbol: string;
  due_date: string;
}

interface MonthlyData {
  [currencyCode: string]: {
    [month: string]: number;
  };
}

const Analytics: React.FC = () => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3001/api/payments?period=all', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const data = await response.json();
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPayments();
    }
  }, [token, fetchPayments]);

  const processData = (): { labels: string[]; datasets: any[] } => {
    const currentYear = new Date().getFullYear();
    const months = [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
    ];

    // Группируем траты по валютам и месяцам
    const monthlyData: MonthlyData = {};
    
    payments.forEach(payment => {
      const paymentDate = new Date(payment.due_date);
      if (paymentDate.getFullYear() === currentYear) {
        const monthKey = `${currentYear}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[payment.currency_code]) {
          monthlyData[payment.currency_code] = {};
        }
        
        if (!monthlyData[payment.currency_code][monthKey]) {
          monthlyData[payment.currency_code][monthKey] = 0;
        }
        
        monthlyData[payment.currency_code][monthKey] += payment.amount;
      }
    });

    // Создаем датасеты для каждой валюты
    const datasets = Object.keys(monthlyData).map((currencyCode, index) => {
      const colors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
        '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
      ];
      
      const data = months.map((_, monthIndex) => {
        const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        return monthlyData[currencyCode][monthKey] || 0;
      });

      return {
        label: currencyCode,
        data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
      };
    });

    return {
      labels: months,
      datasets,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPayments}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const chartData = processData();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Аналитика трат</h1>
          <p className="text-gray-600">
            График показывает ваши траты по месяцам в разных валютах за текущий год
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {payments.length}
              </div>
              <div className="text-sm text-gray-600">Всего трат</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Object.keys(chartData.datasets).length}
              </div>
              <div className="text-sm text-gray-600">Валют</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {new Date().getFullYear()}
              </div>
              <div className="text-sm text-gray-600">Год</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-96">
            <Line 
              data={chartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                    labels: {
                      usePointStyle: true,
                      padding: 20,
                      font: {
                        size: 14,
                        weight: 600,
                      },
                    },
                  },
                  title: {
                    display: true,
                    text: `Траты по месяцам ${new Date().getFullYear()}`,
                    font: {
                      size: 18,
                      weight: 'bold',
                    },
                    padding: 20,
                  },
                  tooltip: {
                    mode: 'index' as const,
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                      label: function(context) {
                        const label = context.dataset.label || '';
                        const value = context.parsed.y;
                        return `${label}: ${new Intl.NumberFormat('ru-RU').format(value)}`;
                      }
                    }
                  },
                },
                scales: {
                  x: {
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)',
                    },
                    ticks: {
                      font: {
                        size: 12,
                        weight: 500,
                      },
                    },
                  },
                  y: {
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)',
                    },
                    ticks: {
                      font: {
                        size: 12,
                        weight: 500,
                      },
                      callback: function(value: any) {
                        return new Intl.NumberFormat('ru-RU').format(value);
                      },
                    },
                  },
                },
                interaction: {
                  mode: 'nearest' as const,
                  axis: 'x' as const,
                  intersect: false,
                },
                elements: {
                  point: {
                    hoverRadius: 8,
                    radius: 6,
                  },
                  line: {
                    tension: 0.4,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Общая статистика по валютам за год */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Общая статистика за {new Date().getFullYear()} год</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chartData.datasets.map((dataset, index) => {
              const totalAmount = dataset.data.reduce((sum: number, amount: number) => sum + amount, 0);
              const colors = [
                '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
                '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
              ];
              const currentColor = colors[index % colors.length];
              
              return (
                <div 
                  key={dataset.label} 
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 hover:scale-105"
                  style={{ 
                    borderTop: `4px solid ${currentColor}`,
                    boxShadow: `0 4px 6px -1px ${currentColor}20, 0 2px 4px -1px ${currentColor}10`
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: currentColor }}
                      ></div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Валюта</p>
                        <p className="text-xl font-bold text-gray-900">{dataset.label}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center mb-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Общая сумма за год</p>
                    <p className="text-3xl font-bold" style={{ color: currentColor }}>
                      {new Intl.NumberFormat('ru-RU').format(totalAmount)}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-600">Среднее в месяц:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('ru-RU').format(Math.round(totalAmount / 12))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-600">Максимум в месяц:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('ru-RU').format(Math.max(...dataset.data))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {chartData.datasets.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-500">Нет данных для отображения статистики</p>
            </div>
          )}
        </div>

        {chartData.datasets.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет данных для отображения</h3>
            <p className="text-gray-600">
              У вас пока нет трат за текущий год. Добавьте несколько платежей, чтобы увидеть график.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
