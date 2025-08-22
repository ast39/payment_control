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

  // Получаем все платежи для указанного месяца
  const query = `
    SELECT p.*, 
           c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
           pc.name as category_name, pc.color as category_color,
           pm.name as payment_method_name
    FROM payments p
    LEFT JOIN currencies c ON p.currency_id = c.id
    LEFT JOIN payment_categories pc ON p.category_id = pc.id
    LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
    WHERE p.user_id = ? 
      AND p.due_date LIKE ?
    ORDER BY p.due_date ASC
  `;
  
  db.all(query, [userId, `${year}-${month.padStart(2, '0')}-%`], (err, payments) => {
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

  // Статусы теперь определяются автоматически по датам

  // Получаем статистику за выбранный месяц
  const monthFilter = month && year ? `AND due_date LIKE ?` : '';
  const monthParams = month && year ? [userId, `${year}-${month.padStart(2, '0')}-%`] : [userId];
  
  // Получаем общую статистику по количеству
  db.get(`
    SELECT 
      COUNT(*) as total_payments,
      SUM(CASE WHEN payment_date IS NULL AND due_date >= date('now') THEN 1 ELSE 0 END) as pending_payments,
      SUM(CASE WHEN payment_date IS NOT NULL THEN 1 ELSE 0 END) as paid_payments,
      SUM(CASE WHEN payment_date IS NULL AND due_date < date('now') THEN 1 ELSE 0 END) as overdue_payments
    FROM payments 
    WHERE user_id = ? ${monthFilter}
  `, monthParams, (err, countStats) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить статистику' 
      });
    }

    // Получаем суммы по валютам
    db.all(`
      SELECT 
        c.id as currency_id,
        c.name as currency_name,
        c.code as currency_code,
        c.symbol as currency_symbol,
        SUM(amount) as total_amount,
        SUM(CASE WHEN payment_date IS NOT NULL THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN payment_date IS NULL AND due_date >= date('now') THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN payment_date IS NULL AND due_date < date('now') THEN amount ELSE 0 END) as overdue_amount
      FROM payments p
      LEFT JOIN currencies c ON p.currency_id = c.id
      WHERE p.user_id = ? ${monthFilter}
      GROUP BY c.id, c.name, c.code, c.symbol
      ORDER BY c.id
    `, monthParams, (err, amountStats) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка базы данных',
          message: 'Не удалось получить суммы по валютам' 
        });
      }

      // Получаем ближайшие платежи (от сегодня до +15 дней)
      db.all(`
        SELECT p.*, 
               c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
               pc.name as category_name, pc.color as category_color,
               pm.name as payment_method_name
        FROM payments p
        LEFT JOIN currencies c ON p.currency_id = c.id
        LEFT JOIN payment_categories pc ON p.category_id = pc.id
        LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
        WHERE p.user_id = ? AND p.payment_date IS NULL AND p.due_date >= date('now') AND p.due_date <= date('now', '+15 days')
        ORDER BY p.due_date ASC 
        LIMIT 10
      `, [userId], (err, upcomingPayments) => {
        if (err) {
          console.error('Ошибка получения ближайших платежей:', err);
        }

        // Получаем ВСЕ просроченные платежи (от новых к старым)
        db.all(`
          SELECT p.*, 
                 c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
                 pc.name as category_name, pc.color as category_color,
                 pm.name as payment_method_name
          FROM payments p
          LEFT JOIN currencies c ON p.currency_id = c.id
          LEFT JOIN payment_categories pc ON p.category_id = pc.id
          LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
          WHERE p.user_id = ? AND p.payment_date IS NULL AND p.due_date < date('now')
          ORDER BY p.due_date DESC
        `, [userId], (err, overduePayments) => {
          if (err) {
            console.error('Ошибка получения просроченных платежей:', err);
          }

          // Получаем исполненные платежи (все исполненные)
          db.all(`
            SELECT p.*, 
                   c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
                   pc.name as category_name, pc.color as category_color,
                   pm.name as payment_method_name
            FROM payments p
            LEFT JOIN currencies c ON p.currency_id = c.id
            LEFT JOIN payment_categories pc ON p.category_id = pc.id
            LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
            WHERE p.user_id = ? AND p.payment_date IS NOT NULL
            ORDER BY p.due_date DESC
          `, [userId], (err, completedPayments) => {
            if (err) {
              console.error('Ошибка получения исполненных платежей:', err);
            }

            db.close();
            // Формируем статистику по валютам
            const currencyStats = {};
            if (amountStats) {
              amountStats.forEach(currency => {
                currencyStats[currency.currency_id] = {
                  currency_id: currency.currency_id,
                  currency_name: currency.currency_name,
                  currency_code: currency.currency_code,
                  currency_symbol: currency.currency_symbol,
                  total_amount: currency.total_amount || 0,
                  paid_amount: currency.paid_amount || 0,
                  pending_amount: currency.pending_amount || 0,
                  overdue_amount: currency.overdue_amount || 0
                };
              });
            }

            res.json({
              stats: {
                total_payments: countStats.total_payments || 0,
                pending_payments: countStats.pending_payments || 0,
                paid_payments: countStats.paid_payments || 0,
                overdue_payments: countStats.overdue_payments || 0,
                total_amount: Object.values(currencyStats),
                paid_amount: Object.values(currencyStats),
                pending_amount: Object.values(currencyStats),
                overdue_amount: Object.values(currencyStats)
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
});

// Получить платежи для конкретного дня
router.get('/day/:date', (req, res) => {
  const { date } = req.params;
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.all(`
    SELECT p.*, 
           c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
           pc.name as category_name, pc.color as category_color,
           pm.name as payment_method_name
    FROM payments p
    LEFT JOIN currencies c ON p.currency_id = c.id
    LEFT JOIN payment_categories pc ON p.category_id = pc.id
    LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
    WHERE p.user_id = ? AND p.due_date = ?
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
