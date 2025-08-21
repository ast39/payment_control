const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты categories
router.use(authenticateToken);

// Получить все категории
router.get('/', (req, res) => {
  const db = new sqlite3.Database(dbPath);

  db.all('SELECT * FROM payment_categories ORDER BY name', (err, categories) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить категории' 
      });
    }

    db.close();
    res.json(categories);
  });
});

// Получить конкретную категорию
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get('SELECT * FROM payment_categories WHERE id = ?', [id], (err, category) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить категорию' 
      });
    }

    if (!category) {
      db.close();
      return res.status(404).json({ 
        error: 'Категория не найдена',
        message: 'Категория с указанным ID не существует' 
      });
    }

    db.close();
    res.json(category);
  });
});

// Создать новую категорию
router.post('/', (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Название категории обязательно' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  db.run(`
    INSERT INTO payment_categories (name, color)
    VALUES (?, ?)
  `, [name, color || '#6B7280'], 
  function(err) {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка создания',
        message: 'Не удалось создать категорию',
        details: err.message 
      });
    }

    const categoryId = this.lastID;
    db.close();
    res.status(201).json({
      message: 'Категория создана успешно',
      id: categoryId
    });
  });
});

// Обновить категорию
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существует ли категория
  db.get('SELECT id FROM payment_categories WHERE id = ?', [id], (err, category) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить категорию' 
      });
    }

    if (!category) {
      db.close();
      return res.status(404).json({ 
        error: 'Категория не найдена',
        message: 'Категория с указанным ID не существует' 
      });
    }

    // Обновляем категорию
    db.run(`
      UPDATE payment_categories 
      SET name = COALESCE(?, name),
          color = COALESCE(?, color)
      WHERE id = ?
    `, [name, color, id], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка обновления',
          message: 'Не удалось обновить категорию' 
        });
      }

      db.close();
      res.json({ message: 'Категория обновлена успешно' });
    });
  });
});

// Удалить категорию
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);

  // Проверяем, используется ли категория в платежах
  db.get('SELECT COUNT(*) as count FROM payments WHERE category_id = ?', [id], (err, result) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить использование категории' 
      });
    }

    if (result.count > 0) {
      db.close();
      return res.status(400).json({ 
        error: 'Невозможно удалить',
        message: 'Категория используется в платежах' 
      });
    }

    // Проверяем, существует ли категория
    db.get('SELECT id FROM payment_categories WHERE id = ?', [id], (err, category) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка базы данных',
          message: 'Не удалось проверить категорию' 
        });
      }

      if (!category) {
        db.close();
        return res.status(404).json({ 
          error: 'Категория не найдена',
          message: 'Категория с указанным ID не существует' 
        });
      }

      // Удаляем категорию
      db.run('DELETE FROM payment_categories WHERE id = ?', [id], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка удаления',
            message: 'Не удалось удалить категорию' 
          });
        }

        db.close();
        res.json({ message: 'Категория удалена успешно' });
      });
    });
  });
});

module.exports = router;
