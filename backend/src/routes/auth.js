const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Логин
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Логин и пароль обязательны' 
    });
  }

  const db = new sqlite3.Database(dbPath);
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить пользователя' 
      });
    }

    if (!user) {
      db.close();
      return res.status(401).json({ 
        error: 'Ошибка авторизации',
        message: 'Неверный логин или пароль' 
      });
    }

    // Проверяем пароль
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка проверки пароля',
          message: 'Не удалось проверить пароль' 
        });
      }

      if (!isMatch) {
        db.close();
        return res.status(401).json({ 
          error: 'Ошибка авторизации',
          message: 'Неверный логин или пароль' 
        });
      }

      // Создаем JWT токен
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          name: user.name 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      db.close();
      res.json({
        message: 'Авторизация успешна',
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      });
    });
  });
});

// Регистрация
router.post('/register', (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Логин, пароль и имя обязательны' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Слабый пароль',
      message: 'Пароль должен быть не менее 6 символов' 
    });
  }

  const db = new sqlite3.Database(dbPath);
  
  // Проверяем, существует ли пользователь
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить пользователя' 
      });
    }

    if (existingUser) {
      db.close();
      return res.status(400).json({ 
        error: 'Пользователь существует',
        message: 'Пользователь с таким логином уже существует' 
      });
    }

    // Хешируем пароль
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Ошибка хеширования',
          message: 'Не удалось создать пользователя' 
        });
      }

      // Создаем пользователя
      db.run('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', 
        [username, hashedPassword, name], function(err) {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка создания',
            message: 'Не удалось создать пользователя' 
          });
        }

        const userId = this.lastID;

        // Создаем настройки по умолчанию
        db.run('INSERT INTO user_settings (user_id, telegram_chat_id, reminder_days) VALUES (?, ?, ?)', 
          [userId, null, 3], (err) => {
          if (err) {
            console.error('Ошибка создания настроек:', err);
          }
          
          db.close();
          res.status(201).json({
            message: 'Пользователь создан успешно',
            user: {
              id: userId,
              username,
              name
            }
          });
        });
      });
    });
  });
});

// Валидация токена
router.get('/validate', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      valid: false,
      error: 'Токен не предоставлен' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(401).json({ 
        valid: false,
        error: 'Токен недействителен' 
      });
    }

    // Токен валиден
    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    });
  });
});

// Обновление токена
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    // Создаем новый токен
    const newToken = jwt.sign(
      { 
        id: req.user.id, 
        username: req.user.username, 
        name: req.user.name 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token: newToken,
      message: 'Токен обновлен'
    });
  } catch (error) {
    console.error('Ошибка обновления токена:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления токена',
      message: 'Не удалось обновить токен' 
    });
  }
});

module.exports = router;
