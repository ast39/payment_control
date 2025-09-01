import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useTokenValidation = () => {
  const { checkTokenValidity, isAuthenticated } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Если не авторизован - очищаем интервал
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Проверяем токен каждые 5 минут
    intervalRef.current = setInterval(async () => {
      await checkTokenValidity();
    }, 5 * 60 * 1000);

    // Проверяем токен сразу при монтировании
    checkTokenValidity();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, checkTokenValidity]);

  // Функция для принудительной проверки токена
  const validateToken = async () => {
    if (isAuthenticated) {
      return await checkTokenValidity();
    }
    return false;
  };

  return { validateToken };
};
