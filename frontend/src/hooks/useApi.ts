import { useAuth } from '../contexts/AuthContext';

export const useApi = () => {
  const { token, logout } = useAuth();

  const apiRequest = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('Токен не найден');
    }

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // Если получили 401 - токен протух
      if (response.status === 401) {
        console.log('Токен протух, разлогиниваемся...');
        logout();
        throw new Error('Токен истек, необходимо переавторизоваться');
      }
      
      // Если получили 403 - токен невалиден
      if (response.status === 403) {
        console.log('Токен невалиден, разлогиниваемся...');
        logout();
        throw new Error('Токен невалиден, необходимо переавторизоваться');
      }
      
      return response;
    } catch (error) {
      // Если ошибка сети - не разлогиниваемся
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw error;
      }
      
      // Для остальных ошибок - разлогиниваемся
      if (error instanceof Error && error.message.includes('токен')) {
        logout();
      }
      
      throw error;
    }
  };

  const get = (url: string) => apiRequest(url, { method: 'GET' });
  
  const post = (url: string, data?: any) => apiRequest(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  
  const put = (url: string, data?: any) => apiRequest(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
  
  const del = (url: string) => apiRequest(url, { method: 'DELETE' });

  return {
    get,
    post,
    put,
    delete: del,
    apiRequest,
  };
};
