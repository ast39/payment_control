const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты payment-methods
router.use(authenticateToken);

// Получить все способы оплаты
router.get('/', (req, res) => {
  const db = new sqlite3.Database(dbPath);

  db.all('SELECT * FROM payment_methods ORDER BY name', (err, methods) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить способы оплаты' 
      });
    }

    db.close();
    res.json(methods);
  });
});

// Получить конкретный способ оплаты
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get('SELECT * FROM payment_methods WHERE id = ?', [id], (err, method) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить способ оплаты' 
      });
    }

    if (!method) {
      db.close();
      return res.status(404).json({ 
        error: 'Способ оплаты не найден',
        message: 'Способ оплаты с указанным ID не существует' 
      });
    }

    db.close();
    res.json(method);
  });
});

// Создать новый способ оплаты
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название способа оплаты обязательно' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  db.run(`
    INSERT INTO payment_methods (name)
    VALUES (?)
  `, [name], 
  function(err) {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать способ оплаты',
        details: err.message 
      });
    }

    const methodId = this.lastID;
    db.close();
    res.status(201).json({
      message: 'Способ оплаты создан успешно',
      id: methodId
    });
  });
});

// Обновить способ оплаты
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли способ оплаты
  db.get('SELECT id FROM payment_methods WHERE id = ?', [id], (err, method) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить способ оплаты' 
      });
    }

    if (!method) {
      db.close();
      return res.status(404).json({ 
        error: 'Способ оплаты не найден',
        message: 'Способ оплаты с указанным ID не существует' 
      });
    }

    // Обновляем способ оплаты
    db.run(`
      UPDATE payment_methods 
      SET name = COALESCE(?, name)
      WHERE id = ?
    `, [name, id], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка обновления',
          message: 'Не удалось обновить способ оплаты' 
        });
      }

      db.close();
      res.json({ message: 'Способ оплаты обновлен успешно' });
    });
  });
});

// Удалить способ оплаты
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  // Проверяем, используется ли способ оплаты в платежах
  db.get('SELECT COUNT(*) as count FROM payments WHERE payment_method_id = ?', [id], (err, result) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить использование способа оплаты' 
      });
    }

    if (result.count > 0) {
      db.close();
      return res.status(400).json({ 
        error: 'Невозможно удалить',
        message: 'Способ оплаты используется в платежах' 
      });
    }

    // Проверяем, существует ли способ оплаты
    db.get('SELECT id FROM payment_methods WHERE id = ?', [id], (err, method) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка базы данных',
          message: 'Не удалось проверить способ оплаты' 
        });
      }

      if (!method) {
        db.close();
        return res.status(404).json({ 
          error: 'Способ оплаты не найден',
          message: 'Способ оплаты с указанным ID не существует' 
        });
      }

      // Удаляем способ оплаты
      db.run('DELETE FROM payment_methods WHERE id = ?', [id], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка удаления',
            message: 'Не удалось удалить способ оплаты' 
          });
        }

        db.close();
        res.json({ message: 'Способ оплаты удален успешно' });
      });
    });
  });
});

module.exports = router;
