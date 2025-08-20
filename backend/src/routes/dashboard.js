const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты dashboard
router.use(authenticateToken);

// Получить данные для дашборда (платежи по месяцам)
router.get('/calendar/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  console.log('=== CALENDAR ROUTE ===');
  console.log('Params:', { year, month });
  console.log('userId:', userId);


  


  // Получаем все платежи для указанного месяца
  const query = `
    SELECT p.*
    FROM payments p
    WHERE p.user_id = ? 
      AND substr(p.due_date, 1, 4) = ? AND substr(p.due_date, 6, 2) = ?
    ORDER BY p.due_date ASC
  `;
  

  
  console.log('Calendar query params:', [userId, year, month.padStart(2, '0')]);
  db.all(query, [userId, year, month.padStart(2, '0')], (err, payments) => {
    if (err) {
      console.error('Calendar DB error:', err);
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить данные календаря' 
      });
    }
    
    console.log('Calendar payments found:', payments.length);
    console.log('First few payments:', payments.slice(0, 3));
    


    // Группируем платежи по дням
    const calendarData = {};
    payments.forEach(payment => {
      const day = payment.due_date.split('-')[2];
      // Убираем ведущий ноль из дня (05 -> 5, 07 -> 7)
      const dayKey = day.replace(/^0+/, '');
      
      if (!calendarData[dayKey]) {
        calendarData[dayKey] = [];
      }
      
      // Определяем цвет платежа по новым правилам
      let color = 'blue'; // запланированный
      if (payment.payment_date && payment.payment_date !== null && payment.payment_date !== 'null') {
        color = 'green'; // оплачен
      } else {
        const dueDate = new Date(payment.due_date);
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          color = 'red'; // просрочен
        } else if (diffDays <= 5) {
          color = 'yellow'; // менее 5 дней
        }
      }
      
      calendarData[dayKey].push({
        ...payment,
        color
      });
    });

    db.close();
    res.json(calendarData);
  });
});

// Получить статистику для дашборда
router.get('/stats', (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query; // Получаем месяц и год из query параметров
  const db = new sqlite3.Database(dbPath);

  console.log('=== STATS ROUTE ===');
  console.log('Query params:', { month, year });
  console.log('userId:', userId);

  // Статусы теперь определяются автоматически по датам

  // Получаем статистику за выбранный месяц
  const monthFilter = month && year ? `AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?` : '';
  const monthParams = month && year ? [userId, year, month.padStart(2, '0')] : [userId];
  
  console.log('monthFilter:', monthFilter);
  console.log('monthParams:', monthParams);
  
  db.get(`
    SELECT 
      COUNT(*) as total_payments,
      SUM(CASE WHEN payment_date IS NULL AND due_date >= date('now') THEN 1 ELSE 0 END) as pending_payments,
      SUM(CASE WHEN payment_date IS NOT NULL THEN 1 ELSE 0 END) as paid_payments,
      SUM(CASE WHEN payment_date IS NULL AND due_date < date('now') THEN 1 ELSE 0 END) as overdue_payments,
      SUM(amount) as total_amount,
      SUM(CASE WHEN payment_date IS NOT NULL THEN amount ELSE 0 END) as paid_amount,
      SUM(CASE WHEN payment_date IS NULL AND due_date >= date('now') THEN amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN payment_date IS NULL AND due_date < date('now') THEN amount ELSE 0 END) as overdue_amount
    FROM payments 
    WHERE user_id = ? ${monthFilter}
  `, monthParams, (err, stats) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить статистику' 
      });
    }

    // Получаем ближайшие платежи (сегодня + 1 месяц)
    const upcomingFilter = month && year ? 
      `AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?` : 
      `AND due_date >= date('now') AND due_date <= date('now', '+1 month')`;
    const upcomingParams = month && year ? [userId, year, month.padStart(2, '0')] : [userId];
    
    db.all(`
      SELECT * FROM payments 
      WHERE user_id = ? AND payment_date IS NULL AND due_date >= date('now') ${upcomingFilter}
      ORDER BY due_date ASC 
      LIMIT 10
    `, upcomingParams, (err, upcomingPayments) => {
      if (err) {
        console.error('Ошибка получения ближайших платежей:', err);
      }

      // Получаем просроченные платежи (выбранный месяц)
      const overdueFilter = month && year ? 
        `AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?` : 
        `AND substr(due_date, 1, 7) = ?`;
      const overdueParams = month && year ? 
        [userId, year, month.padStart(2, '0')] : 
        [userId, new Date().toISOString().substr(0, 7)];
      
      db.all(`
        SELECT * FROM payments 
        WHERE user_id = ? AND payment_date IS NULL AND due_date < date('now')
          ${overdueFilter}
        ORDER BY due_date ASC
      `, overdueParams, (err, overduePayments) => {
        if (err) {
          console.error('Ошибка получения просроченных платежей:', err);
        }

        // Получаем исполненные платежи (выбранный месяц)
        const completedFilter = month && year ? 
          `AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?` : 
          `AND substr(due_date, 1, 7) = ?`;
        const completedParams = month && year ? 
          [userId, year, month.padStart(2, '0')] : 
          [userId, new Date().toISOString().substr(0, 7)];
        
        db.all(`
          SELECT * FROM payments 
          WHERE user_id = ? AND payment_date IS NOT NULL ${completedFilter}
          ORDER BY due_date DESC
          LIMIT 10
        `, completedParams, (err, completedPayments) => {
          if (err) {
            console.error('Ошибка получения исполненных платежей:', err);
          }

          db.close();
                  res.json({
          stats: {
            total_payments: stats.total_payments || 0,
            pending_payments: stats.pending_payments || 0,
            paid_payments: stats.paid_payments || 0,
            overdue_payments: stats.overdue_payments || 0,
            total_amount: stats.total_amount || 0,
            paid_amount: stats.paid_amount || 0,
            pending_amount: stats.pending_amount || 0,
            overdue_amount: stats.overdue_amount || 0
          },
          upcoming_payments: upcomingPayments || [],
          overdue_payments: overduePayments || [],
          completed_payments: completedPayments || []
        });
        });
      });
    });
  });
});

// Получить платежи для конкретного дня
router.get('/day/:date', (req, res) => {
  const { date } = req.params;
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.all(`
    SELECT * FROM payments
    WHERE user_id = ? AND due_date = ?
    ORDER BY amount DESC
  `, [userId, date], (err, payments) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить платежи за день' 
      });
    }

    db.close();
    res.json(payments);
  });
});

module.exports = router;
