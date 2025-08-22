import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Copy, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const Seeding: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Текущий месяц и год
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Состояние для выбора месяцев
  const [sourceMonth, setSourceMonth] = useState(currentMonth);
  const [sourceYear, setSourceYear] = useState(currentYear);
  const [targetMonth, setTargetMonth] = useState(currentMonth + 1);
  const [targetYear, setTargetYear] = useState(currentYear);
  
  // Если targetMonth > 11, переходим на следующий год
  if (targetMonth > 11) {
    setTargetMonth(0);
    setTargetYear(targetYear + 1);
  }

  const handleSeeding = async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:3001/api/seeding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceMonth: sourceMonth + 1, // +1 потому что месяцы в JS начинаются с 0
          sourceYear,
          targetMonth: targetMonth + 1,
          targetYear
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`Успешно посеяно ${data.seeded_count} платежей!`);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка посева');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const date = new Date(2024, month, 1);
    return format(date, 'MMMM', { locale: ru });
  };

  const getYearOptions = () => {
    const years = [];
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
      years.push(year);
    }
    return years;
  };

  const getMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i);
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center space-x-3">
        <Copy className="w-8 h-8 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Посевы</h1>
      </div>

      {/* Описание */}
      <div className="card">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Как работает посев?</h3>
            <p className="text-gray-600">
              Выберите месяц, с которого хотите скопировать платежи, и месяц, на который хотите их посеять. 
              Все платежи будут скопированы с <strong>payment_date = null</strong> (не оплаченные), 
              чтобы вы могли заново планировать их на новый период.
            </p>
          </div>
        </div>
      </div>

      {/* Форма посева */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Настройки посева</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Источник */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700 flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Откуда копируем</span>
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Месяц
                </label>
                <select
                  value={sourceMonth}
                  onChange={(e) => setSourceMonth(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {getMonthOptions().map((month) => (
                    <option key={month} value={month}>
                      {getMonthName(month)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Год
                </label>
                <select
                  value={sourceYear}
                  onChange={(e) => setSourceYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {getYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Цель */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700 flex items-center space-x-2">
              <Copy className="w-4 h-4" />
              <span>Куда сеем</span>
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Месяц
                </label>
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {getMonthOptions().map((month) => (
                    <option key={month} value={month}>
                      {getMonthName(month)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Год
                </label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {getYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопка посева */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleSeeding}
            disabled={loading}
            className="btn-primary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Сеем...</span>
              </>
            ) : (
              <>
                <Copy size={20} />
                <span>ПРОСЕЯТЬ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Сообщения об успехе/ошибке */}
      {success && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-green-800 font-medium">{success}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-red-800 font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Seeding;
