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

  // Сначала обновляем статусы просроченных платежей для этого месяца
  db.run(`
    UPDATE payments 
    SET status = 'overdue' 
    WHERE user_id = ? AND status = 'pending' AND due_date < date('now')
      AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?
  `, [userId, year, month.padStart(2, '0')], (err) => {
    if (err) {
      console.error('Ошибка обновления просроченных платежей для календаря:', err);
    }
  });
  


  // Получаем все платежи для указанного месяца
  const query = `
    SELECT p.*, 
           COUNT(ph.id) as payment_count,
           SUM(ph.amount_paid) as total_paid
    FROM payments p
    LEFT JOIN payment_history ph ON p.id = ph.payment_id
    WHERE p.user_id = ? 
      AND substr(p.due_date, 1, 4) = ?
      AND substr(p.due_date, 6, 2) = ?
    GROUP BY p.id
    ORDER BY p.due_date ASC
  `;
  

  
  db.all(query, [userId, year, month.padStart(2, '0')], (err, payments) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить данные календаря' 
      });
    }
    


    // Группируем платежи по дням
    const calendarData = {};
    payments.forEach(payment => {
      const day = payment.due_date.split('-')[2];
      if (!calendarData[day]) {
        calendarData[day] = [];
      }
      
      // Определяем цвет платежа
      let color = 'blue'; // запланированный
      if (payment.status === 'paid') {
        color = 'green'; // оплачен
      } else if (payment.status === 'overdue') {
        color = 'red'; // просрочен
      } else {
        const dueDate = new Date(payment.due_date);
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 5 && diffDays >= 0) {
          color = 'yellow'; // менее 5 дней
        }
      }
      
      calendarData[day].push({
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

  // Сначала обновляем статусы просроченных платежей
  db.run(`
    UPDATE payments 
    SET status = 'overdue' 
    WHERE user_id = ? AND status = 'pending' AND due_date < date('now')
  `, [userId], (err) => {
    if (err) {
      console.error('Ошибка обновления просроченных платежей:', err);
    }
  });

  // Получаем статистику за выбранный месяц
  const monthFilter = month && year ? `AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?` : '';
  const monthParams = month && year ? [userId, year, month.padStart(2, '0')] : [userId];
  
  db.get(`
    SELECT 
      COUNT(*) as total_payments,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_payments,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_payments,
      SUM(amount) as total_amount,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as overdue_amount
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
      WHERE user_id = ? AND status = 'pending' ${upcomingFilter}
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
        WHERE user_id = ? AND (status = 'overdue' OR (status = 'pending' AND due_date < date('now')))
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
          WHERE user_id = ? AND status = 'paid' ${completedFilter}
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
    SELECT p.*, 
           COUNT(ph.id) as payment_count,
           SUM(ph.amount_paid) as total_paid
    FROM payments p
    LEFT JOIN payment_history ph ON p.id = ph.payment_id
    WHERE p.user_id = ? AND p.due_date = ?
    GROUP BY p.id
    ORDER BY p.amount DESC
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
