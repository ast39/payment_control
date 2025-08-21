const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты currencies
router.use(authenticateToken);

// Получить все валюты
router.get('/', (req, res) => {
  const db = new sqlite3.Database(dbPath);

  db.all('SELECT * FROM currencies ORDER BY name', (err, currencies) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить валюты' 
      });
    }

    db.close();
    res.json(currencies);
  });
});

// Получить конкретную валюту
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get('SELECT * FROM currencies WHERE id = ?', [id], (err, currency) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить валюту' 
      });
    }

    if (!currency) {
      db.close();
      return res.status(404).json({ 
        error: 'Валюта не найдена',
        message: 'Валюта с указанным ID не существует' 
      });
    }

    db.close();
    res.json(currency);
  });
});

// Создать новую валюту
router.post('/', (req, res) => {
  const { name, code, symbol } = req.body;

  if (!name || !code || !symbol) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название, код и символ обязательны' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  db.run(`
    INSERT INTO currencies (name, code, symbol)
    VALUES (?, ?, ?)
  `, [name, code, symbol], 
  function(err) {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать валюту',
        details: err.message 
      });
    }

    const currencyId = this.lastID;
    db.close();
    res.status(201).json({
      message: 'Валюта создана успешно',
      id: currencyId
    });
  });
});

// Обновить валюту
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, symbol } = req.body;

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли валюта
  db.get('SELECT id FROM currencies WHERE id = ?', [id], (err, currency) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить валюту' 
      });
    }

    if (!currency) {
      db.close();
      return res.status(404).json({ 
        error: 'Валюта не найдена',
        message: 'Валюта с указанным ID не существует' 
      });
    }

    // Обновляем валюту
    db.run(`
      UPDATE currencies 
      SET name = COALESCE(?, name),
          code = COALESCE(?, code),
          symbol = COALESCE(?, symbol)
      WHERE id = ?
    `, [name, code, symbol, id], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка обновления',
          message: 'Не удалось обновить валюту' 
        });
      }

      db.close();
      res.json({ message: 'Валюта обновлена успешно' });
    });
  });
});

// Удалить валюту
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  // Проверяем, используется ли валюта в платежах
  db.get('SELECT COUNT(*) as count FROM payments WHERE currency_id = ?', [id], (err, result) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить использование валюты' 
      });
    }

    if (result.count > 0) {
      db.close();
      return res.status(400).json({ 
        error: 'Невозможно удалить',
        message: 'Валюта используется в платежах' 
      });
    }

    // Проверяем, существует ли валюта
    db.get('SELECT id FROM currencies WHERE id = ?', [id], (err, currency) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка базы данных',
          message: 'Не удалось проверить валюту' 
        });
      }

      if (!currency) {
        db.close();
        return res.status(404).json({ 
          error: 'Валюта не найдена',
          message: 'Валюта с указанным ID не существует' 
        });
      }

      // Удаляем валюту
      db.run('DELETE FROM currencies WHERE id = ?', [id], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка удаления',
            message: 'Не удалось удалить валюту' 
          });
        }

        db.close();
        res.json({ message: 'Валюта удалена успешно' });
      });
    });
  });
});

module.exports = router;
