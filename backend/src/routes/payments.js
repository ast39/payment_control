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
  const { period = 'current', currency_id, category_id, payment_method_id } = req.query; // Получаем все параметры фильтрации
  const db = new sqlite3.Database(dbPath);

  let whereClause = 'WHERE p.user_id = ?';
  let params = [userId];

  switch (period) {
    case 'previous':
      whereClause += ` AND substr(p.due_date, 1, 7) = substr(date('now', '-1 month'), 1, 7)`;
      break;
    case 'current':
      whereClause += ` AND substr(p.due_date, 1, 7) = substr(date('now'), 1, 7)`;
      break;
    case 'next':
      whereClause += ` AND substr(p.due_date, 1, 7) = substr(date('now', '+1 month'), 1, 7)`;
      break;
    case 'all':
      // Без дополнительных фильтров - все платежи
      break;
    default:
      whereClause += ` AND substr(p.due_date, 1, 7) = substr(date('now'), 1, 7)`;
      break;
  }

  // Добавляем фильтры по валюте, категории и способу оплаты
  if (currency_id) {
    whereClause += ` AND p.currency_id = ?`;
    params.push(currency_id);
  }

  if (category_id) {
    whereClause += ` AND p.category_id = ?`;
    params.push(category_id);
  }

  if (payment_method_id) {
    whereClause += ` AND p.payment_method_id = ?`;
    params.push(payment_method_id);
  }

  const query = `
    SELECT p.*, 
           c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
           pc.name as category_name, pc.color as category_color,
           pm.name as payment_method_name
    FROM payments p
    LEFT JOIN currencies c ON p.currency_id = c.id
    LEFT JOIN payment_categories pc ON p.category_id = pc.id
    LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
    ${whereClause}
    ORDER BY p.due_date DESC
  `;



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

  const query = `
    SELECT p.*, 
           c.name as currency_name, c.code as currency_code, c.symbol as currency_symbol,
           pc.name as category_name, pc.color as category_color,
           pm.name as payment_method_name
    FROM payments p
    LEFT JOIN currencies c ON p.currency_id = c.id
    LEFT JOIN payment_categories pc ON p.category_id = pc.id
    LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
    WHERE p.id = ? AND p.user_id = ?
  `;

  db.get(query, [id, userId], (err, payment) => {
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
  const userId = req.user.id;
  
  const { title, description, amount, currency_id, category_id, payment_method_id, payment_date, due_date } = req.body;
  
  // due_date - дата когда должен быть оплачен (обязательно)
  // payment_date - дата фактической оплаты (может быть null)

  if (!title || !amount || !due_date) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название, сумма и дата обязательны' 
    });
  }

  const db = new sqlite3.Database(dbPath);
  
  db.run(`
    INSERT INTO payments (user_id, title, description, amount, currency_id, category_id, payment_method_id, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, title, description || null, amount, currency_id || 1, category_id || 1, payment_method_id || 1, due_date], 
  function(err) {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать платеж',
        details: err.message 
      });
    }

    const paymentId = this.lastID;

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
  const { title, description, amount, currency_id, category_id, payment_method_id, payment_date, due_date } = req.body;

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
          currency_id = COALESCE(?, currency_id),
          category_id = COALESCE(?, category_id),
          payment_method_id = COALESCE(?, payment_method_id),
          payment_date = COALESCE(?, payment_date),
          due_date = COALESCE(?, due_date)
      WHERE id = ? AND user_id = ?
    `, [title, description, amount, currency_id, category_id, payment_method_id, payment_date, due_date, id, userId], (err) => {
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
