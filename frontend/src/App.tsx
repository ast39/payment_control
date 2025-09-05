import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Payments from './components/payments/Payments';
import Analytics from './components/analytics/Analytics';
import Currencies from './components/currencies/Currencies';
import Categories from './components/categories/Categories';
import PaymentMethods from './components/payment-methods/PaymentMethods';
import Seeding from './components/seeding/Seeding';
import Settings from './components/settings/Settings';
import Layout from './components/layout/Layout';
import PWAInstaller from './components/PWAInstaller';
import { useTokenValidation } from './hooks/useTokenValidation';

// Защищенный маршрут
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, checkTokenValidity } = useAuth();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (isAuthenticated) {
        const isValid = await checkTokenValidity();
        if (!isValid) {
          // Токен невалиден - редирект произойдет автоматически через logout в checkTokenValidity
          return;
        }
      }
      setIsValidating(false);
    };

    validateToken();
  }, [isAuthenticated, checkTokenValidity]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Глобальный перехватчик ошибок авторизации
const GlobalErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();

  useEffect(() => {
    // Перехватываем все fetch запросы
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Если получили 401 или 403 - разлогиниваемся
        if (response.status === 401 || response.status === 403) {
          console.log('Обнаружена ошибка авторизации, разлогиниваемся...');
          logout();
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    };

    // Восстанавливаем оригинальный fetch при размонтировании
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { loading } = useAuth();
  useTokenValidation(); // Автоматическая проверка токена

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка приложения...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="payments" element={<Payments />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="currencies" element={<Currencies />} />
        <Route path="categories" element={<Categories />} />
        <Route path="payment-methods" element={<PaymentMethods />} />
        <Route path="seeding" element={<Seeding />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <GlobalErrorHandler>
          <AppRoutes />
          <PWAInstaller />
        </GlobalErrorHandler>
      </AuthProvider>
    </Router>
  );
};

export default App;
