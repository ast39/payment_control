const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');

// Демон для уведомлений о платежах
const { startNotificationDaemon } = require('./scripts/paymentNotifier');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, '../../build')));

// API маршруты
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Middleware для проверки JWT токена
const authenticateToken = require('./middleware/auth');

// Защищенные маршруты
app.use('/api/payments', authenticateToken);
app.use('/api/settings', authenticateToken);
app.use('/api/dashboard', authenticateToken);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Что-то пошло не так!',
    message: err.message 
  });
});

// Для SPA - все остальные запросы на фронт
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../build/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 API доступен по адресу http://localhost:${PORT}/api`);
  
  // Запускаем демон уведомлений
  startNotificationDaemon();
});
