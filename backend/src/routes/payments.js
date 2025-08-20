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
  const { period = 'current' } = req.query; // Получаем период из query параметров
  const db = new sqlite3.Database(dbPath);

  let whereClause = 'WHERE user_id = ?';
  let params = [userId];

  switch (period) {
    case 'previous':
      whereClause += ` AND substr(due_date, 1, 7) = substr(date('now', '-1 month'), 1, 7)`;
      break;
    case 'current':
      whereClause += ` AND substr(due_date, 1, 7) = substr(date('now'), 1, 7)`;
      break;
    case 'next':
      whereClause += ` AND substr(due_date, 1, 7) = substr(date('now', '+1 month'), 1, 7)`;
      break;
    case 'all':
      // Без дополнительных фильтров - все платежи
      break;
    default:
      whereClause += ` AND substr(due_date, 1, 7) = substr(date('now'), 1, 7)`;
      break;
  }

  const query = `
    SELECT * FROM payments
    ${whereClause}
    ORDER BY due_date DESC
  `;

  console.log('Payments query:', query);
  console.log('Payments params:', params);

  db.all(query, params, (err, payments) => {
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

  db.get('SELECT * FROM payments WHERE id = ? AND user_id = ?', [id, userId], (err, payment) => {
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

    db.close();
    res.json(payment);
  });
});

// Создать новый платеж
router.post('/', (req, res) => {
  console.log('=== СОЗДАНИЕ ПЛАТЕЖА ===');
  console.log('req.body:', req.body);
  
  const userId = req.user.id;
  console.log('userId:', userId);
  
  const { title, description, amount, payment_date, due_date } = req.body;
  console.log('Извлеченные данные:', { title, description, amount, payment_date, due_date });
  
  // due_date - дата когда должен быть оплачен (обязательно)
  // payment_date - дата фактической оплаты (может быть null)

  if (!title || !amount || !due_date) {
    console.log('Ошибка валидации:', { title, amount, due_date });
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название, сумма и дата обязательны' 
    });
  }

  console.log('Данные прошли валидацию, создаю БД соединение...');
  const db = new sqlite3.Database(dbPath);

  console.log('SQL запрос:', `
    INSERT INTO payments (user_id, title, description, amount, due_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  console.log('Параметры:', [userId, title, description || null, amount, due_date]);
  
  db.run(`
    INSERT INTO payments (user_id, title, description, amount, due_date)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, title, description || null, amount, due_date], 
  function(err) {
    if (err) {
      console.log('ОШИБКА SQL:', err);
      console.log('Код ошибки:', err.code);
      console.log('Сообщение ошибки:', err.message);
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать платеж',
        details: err.message 
      });
    }

    const paymentId = this.lastID;
    console.log('Платеж создан успешно! ID:', paymentId);

    db.close();
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
  const { title, description, amount, payment_date, due_date } = req.body;

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
          due_date = COALESCE(?, due_date)
      WHERE id = ? AND user_id = ?
    `, [title, description, amount, payment_date, due_date, id, userId], (err) => {
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

    // Удаляем платеж
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

    // Обновляем дату оплаты
    db.run('UPDATE payments SET payment_date = ? WHERE id = ?', [payment_date, id], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка обновления',
          message: 'Не удалось обновить платеж' 
        });
      }

      db.close();
      res.json({ 
        message: 'Платеж отмечен как оплаченный'
      });
    });
  });
});

module.exports = router;
