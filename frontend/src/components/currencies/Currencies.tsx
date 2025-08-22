import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Coins
} from 'lucide-react';

interface Currency {
  id: number;
  name: string;
  code: string;
  symbol: string;
}

interface CurrencyModalProps {
  currency: Currency | null;
  onClose: () => void;
  onSaved: () => void;
}

const CurrencyModal: React.FC<CurrencyModalProps> = ({ currency, onClose, onSaved }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    symbol: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!currency && currency.id;

  useEffect(() => {
    if (currency && currency.id) {
      setFormData({
        name: currency.name || '',
        code: currency.code || '',
        symbol: currency.symbol || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        symbol: ''
      });
    }
  }, [currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.code || !formData.symbol) {
      setError('Заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing && currency
        ? `http://localhost:3001/api/currencies/${currency.id}`
        : 'http://localhost:3001/api/currencies';
      
      const method = isEditing && currency ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          symbol: formData.symbol
        })
      });

      if (response.ok) {
        onSaved();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка сохранения валюты:', error);
      setError('Не удалось сохранить валюту');
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
              <Coins className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing && currency ? 'Редактировать валюту' : 'Создать валюту'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <span className="text-2xl">&times;</span>
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Название валюты *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="input"
              placeholder="Например: Российский рубль"
              required
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Код валюты *
            </label>
            <input
              id="code"
              type="text"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              className="input"
              placeholder="Например: RUB"
              maxLength={3}
              required
            />
          </div>

          <div>
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
              Символ валюты *
            </label>
            <input
              id="symbol"
              type="text"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value)}
              className="input"
              placeholder="Например: ₽"
              maxLength={5}
              required
            />
          </div>

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
                <span>{loading ? 'Сохранение...' : (isEditing && currency ? 'Обновить' : 'Создать')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Currencies: React.FC = () => {
  const { token } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

  const fetchCurrencies = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/currencies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrencies(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки валют:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, [token]);

  const handleCreateCurrency = () => {
    setEditingCurrency(null);
    setShowModal(true);
  };

  const handleEditCurrency = (currency: Currency) => {
    setEditingCurrency(currency);
    setShowModal(true);
  };

  const handleDeleteCurrency = async (id: number) => {
    if (!token || !window.confirm('Вы уверены, что хотите удалить эту валюту?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/currencies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchCurrencies();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Ошибка удаления валюты:', error);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingCurrency(null);
  };

  const handleCurrencySaved = () => {
    fetchCurrencies();
    handleModalClose();
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
        <h1 className="text-2xl font-bold text-gray-900">Валюты</h1>
        <button
          onClick={handleCreateCurrency}
          className="btn-primary inline-flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Создать валюту</span>
        </button>
      </div>

      {/* Список валют */}
      <div className="card">
        {currencies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Код
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Символ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currencies.map((currency) => (
                  <tr key={currency.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Coins className="w-5 h-5 text-gray-400 mr-3" />
                        <div className="text-sm font-medium text-gray-900">
                          {currency.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {currency.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {currency.symbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-left">
                      <div className="flex items-center space-x-2 justify-end">
                        <button
                          onClick={() => handleEditCurrency(currency)}
                          className="text-warning-600 hover:text-warning-900 p-1"
                          title="Редактировать"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCurrency(currency.id)}
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
            <Coins className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет валют</h3>
            <p className="mt-1 text-sm text-gray-500">
              Создайте первую валюту для управления платежами.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateCurrency}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span>Создать валюту</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {showModal && (
        <CurrencyModal
          currency={editingCurrency}
          onClose={handleModalClose}
          onSaved={handleCurrencySaved}
        />
      )}
    </div>
  );
};

export default Currencies;
