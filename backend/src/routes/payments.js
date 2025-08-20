const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты payments
router.use(authenticateToken);

// Получить все платежи пользователя
router.get('/', (req, res) => {
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.all(`
    SELECT p.*, 
           COUNT(ph.id) as payment_count,
           SUM(ph.amount_paid) as total_paid
    FROM payments p
    LEFT JOIN payment_history ph ON p.id = ph.payment_id
    WHERE p.user_id = ? 
    AND p.due_date <= date('now', '+1 month')
    GROUP BY p.id
    ORDER BY p.due_date DESC
  `, [userId], (err, payments) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить платежи' 
      });
    }

    db.close();
    res.json(payments);
  });
});

// Получить конкретный платеж
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.get(`
    SELECT p.*, 
           COUNT(ph.id) as payment_count,
           SUM(ph.amount_paid) as total_paid
    FROM payments p
    LEFT JOIN payment_history ph ON p.id = ph.payment_id
    WHERE p.id = ? AND p.user_id = ?
    GROUP BY p.id
  `, [id, userId], (err, payment) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить платеж' 
      });
    }

    if (!payment) {
      db.close();
      return res.status(404).json({ 
        error: 'Платеж не найден',
        message: 'Платеж с указанным ID не существует' 
      });
    }

    // Получаем историю платежей
    db.all('SELECT * FROM payment_history WHERE payment_id = ? ORDER BY payment_date DESC', 
      [id], (err, history) => {
      if (err) {
        console.error('Ошибка получения истории:', err);
      }
      
      db.close();
      res.json({
        ...payment,
        history: history || []
      });
    });
  });
});

// Создать новый платеж
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { title, description, amount, payment_date, due_date, frequency, end_date } = req.body;

  if (!title || !amount || !due_date) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название, сумма и дата обязательны' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  db.run(`
    INSERT INTO payments (user_id, title, description, amount, payment_date, due_date, frequency, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, title, description || null, amount, payment_date || due_date, due_date, frequency || 'once', end_date], 
  function(err) {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать платеж' 
      });
    }

    const paymentId = this.lastID;

    // Если это периодический платеж, создаем записи для каждого периода
    if (frequency && frequency !== 'once') {
      const startDate = new Date(due_date);
      // Если end_date не указан, устанавливаем максимум на 1 год вперед
      const endDate = end_date ? new Date(end_date) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
      let currentDate = new Date(startDate);
      
      // Функция для корректного расчета следующей даты
      const getNextDate = (date, freq) => {
        const newDate = new Date(date);
        switch (freq) {
          case 'daily':
            newDate.setDate(newDate.getDate() + 1);
            break;
          case 'weekly':
            newDate.setDate(newDate.getDate() + 7);
            break;
          case 'monthly':
            // Сохраняем день месяца, если возможно
            const currentDay = newDate.getDate();
            newDate.setMonth(newDate.getMonth() + 1);
            // Если день месяца изменился (например, было 31, стало 1), 
            // значит в следующем месяце нет такого дня - переносим на последний день
            if (newDate.getDate() !== currentDay) {
              newDate.setDate(0); // Последний день предыдущего месяца
            }
            break;
          case 'yearly':
            newDate.setFullYear(newDate.getFullYear() + 1);
            break;
        }
        return newDate;
      };
      
      // Пропускаем первую дату, так как основной платеж уже создан
      currentDate = getNextDate(currentDate, frequency);

      const createPeriodicPayments = () => {
        if (currentDate > endDate) {
          db.close();
          return;
        }

        // Создаем платеж даже если дата в прошлом
        db.run(`
          INSERT INTO payments (user_id, title, description, amount, payment_date, due_date, frequency, end_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, title, description || null, amount, currentDate.toISOString().split('T')[0], 
            currentDate.toISOString().split('T')[0], frequency, end_date, 
            currentDate < new Date() ? 'overdue' : 'pending'], (err) => {
          if (err) {
            // Ошибка создания периодического платежа
          }

          // Увеличиваем дату согласно периодичности
          currentDate = getNextDate(currentDate, frequency);

          createPeriodicPayments();
        });
      };

      createPeriodicPayments();
    } else {
      db.close();
    }

    res.status(201).json({
      message: 'Платеж создан успешно',
      id: paymentId
    });
  });
});

// Обновить платеж
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, description, amount, payment_date, due_date, frequency, end_date, status } = req.body;

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли платеж и принадлежит ли он пользователю
  db.get('SELECT id FROM payments WHERE id = ? AND user_id = ?', [id, userId], (err, payment) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить платеж' 
      });
    }

    if (!payment) {
      db.close();
      return res.status(404).json({ 
        error: 'Платеж не найден',
        message: 'Платеж с указанным ID не существует' 
      });
    }

    // Обновляем платеж
    db.run(`
      UPDATE payments 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          amount = COALESCE(?, amount),
          payment_date = COALESCE(?, payment_date),
          due_date = COALESCE(?, due_date),
          frequency = COALESCE(?, frequency),
          end_date = COALESCE(?, end_date),
          status = COALESCE(?, status)
      WHERE id = ? AND user_id = ?
    `, [title, description, amount, payment_date, due_date, frequency, end_date, status, id, userId], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка обновления',
          message: 'Не удалось обновить платеж' 
        });
      }

      db.close();
      res.json({ message: 'Платеж обновлен успешно' });
    });
  });
});

// Удалить платеж
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли платеж и принадлежит ли он пользователю
  db.get('SELECT id FROM payments WHERE id = ? AND user_id = ?', [id, userId], (err, payment) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить платеж' 
      });
    }

    if (!payment) {
      db.close();
      return res.status(404).json({ 
        error: 'Платеж не найден',
        message: 'Платеж с указанным ID не существует' 
      });
    }

    // Удаляем историю платежей
    db.run('DELETE FROM payment_history WHERE payment_id = ?', [id], (err) => {
      if (err) {
        console.error('Ошибка удаления истории:', err);
      }

      // Удаляем сам платеж
      db.run('DELETE FROM payments WHERE id = ? AND user_id = ?', [id, userId], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка удаления',
            message: 'Не удалось удалить платеж' 
          });
        }

        db.close();
        res.json({ message: 'Платеж удален успешно' });
      });
    });
  });
});

// Отметить платеж как оплаченный
router.post('/:id/pay', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { amount_paid, payment_date } = req.body;

  if (!amount_paid || !payment_date) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Сумма и дата оплаты обязательны' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли платеж и принадлежит ли он пользователю
  db.get('SELECT * FROM payments WHERE id = ? AND user_id = ?', [id, userId], (err, payment) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить платеж' 
      });
    }

    if (!payment) {
      db.close();
      return res.status(404).json({ 
        error: 'Платеж не найден',
        message: 'Платеж с указанным ID не существует' 
      });
    }

    // Добавляем запись в историю
    db.run(`
      INSERT INTO payment_history (payment_id, amount_paid, payment_date)
      VALUES (?, ?, ?)
    `, [id, amount_paid, payment_date], function(err) {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка записи',
          message: 'Не удалось записать оплату' 
        });
      }

      // Обновляем статус платежа
      db.run('UPDATE payments SET status = ? WHERE id = ?', ['paid', id], (err) => {
        if (err) {
          console.error('Ошибка обновления статуса:', err);
        }

        db.close();
        res.json({ 
          message: 'Оплата записана успешно',
          history_id: this.lastID
        });
      });
    });
  });
});

module.exports = router;
