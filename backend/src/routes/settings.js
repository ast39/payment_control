const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты settings
router.use(authenticateToken);

// Получить настройки пользователя
router.get('/', (req, res) => {
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.get('SELECT * FROM user_settings WHERE user_id = ?', [userId], (err, settings) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить настройки' 
      });
    }

    if (!settings) {
      // Создаем настройки по умолчанию если их нет
      db.run('INSERT INTO user_settings (user_id, telegram_chat_id, reminder_days) VALUES (?, ?, ?)', 
        [userId, null, 3], function(err) {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка создания',
            message: 'Не удалось создать настройки' 
          });
        }

              db.close();
      res.json({
        telegram_bot_token: null,
        telegram_chat_id: null,
        reminder_days: 3
      });
      });
    } else {
      db.close();
      res.json({
        telegram_bot_token: settings.telegram_bot_token,
        telegram_chat_id: settings.telegram_chat_id,
        reminder_days: settings.reminder_days
      });
    }
  });
});

// Обновить настройки пользователя
router.put('/', (req, res) => {
  const userId = req.user.id;
  const { telegram_bot_token, telegram_chat_id, reminder_days } = req.body;

  if (reminder_days && (reminder_days < 1 || reminder_days > 30)) {
    return res.status(400).json({ 
      error: 'Неверные данные',
      message: 'Количество дней для напоминания должно быть от 1 до 30' 
    });
  }

  const db = new sqlite3.Database(dbPath);

  // Проверяем, существуют ли настройки
  db.get('SELECT id FROM user_settings WHERE user_id = ?', [userId], (err, settings) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось проверить настройки' 
      });
    }

    if (settings) {
      // Обновляем существующие настройки
              db.run(`
          UPDATE user_settings 
          SET telegram_bot_token = COALESCE(?, telegram_bot_token),
              telegram_chat_id = COALESCE(?, telegram_chat_id),
              reminder_days = COALESCE(?, reminder_days),
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `, [telegram_bot_token, telegram_chat_id, reminder_days, userId], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка обновления',
            message: 'Не удалось обновить настройки' 
          });
        }

        db.close();
        res.json({ message: 'Настройки обновлены успешно' });
      });
    } else {
              // Создаем новые настройки
        db.run(`
          INSERT INTO user_settings (user_id, telegram_bot_token, telegram_chat_id, reminder_days)
          VALUES (?, ?, ?, ?)
        `, [userId, telegram_bot_token, telegram_chat_id, reminder_days || 3], (err) => {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Ошибка создания',
            message: 'Не удалось создать настройки' 
          });
        }

        db.close();
        res.json({ message: 'Настройки созданы успешно' });
      });
    }
  });
});

// Тест Telegram уведомления
router.post('/test-telegram', (req, res) => {
  const userId = req.user.id;
  const db = new sqlite3.Database(dbPath);

  db.get('SELECT telegram_bot_token, telegram_chat_id FROM user_settings WHERE user_id = ?', [userId], (err, settings) => {
    if (err) {
      db.close();
      return res.status(500).json({ 
        error: 'Ошибка базы данных',
        message: 'Не удалось получить настройки' 
      });
    }

    if (!settings || !settings.telegram_bot_token || !settings.telegram_chat_id) {
      db.close();
      return res.status(400).json({ 
        error: 'Настройки не найдены',
        message: 'Сначала укажите токен бота и Chat ID Telegram' 
      });
    }

    // Отправляем тестовое уведомление в Telegram
    const testMessage = `🔔 Тестовое уведомление от системы платежей!\n\n📋 Платеж: Интернет\n💰 Сумма: 1500 ₽\n📅 Дата оплаты: 25.12.2024\n⏰ До оплаты осталось: 3 дня\n\n✅ Настройки Telegram работают корректно!`;
    
    fetch(`https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: settings.telegram_chat_id,
        text: testMessage,
        parse_mode: 'HTML'
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.ok) {
        db.close();
        res.json({ 
          message: 'Тестовое уведомление отправлено успешно',
          chat_id: settings.telegram_chat_id
        });
      } else {
        db.close();
        res.status(500).json({ 
          error: 'Ошибка отправки',
          message: `Telegram API вернул ошибку: ${data.description || 'Неизвестная ошибка'}`,
          telegram_error: data
        });
      }
    })
    .catch(error => {
      db.close();
      res.status(500).json({ 
        error: 'Ошибка отправки',
        message: 'Не удалось отправить уведомление в Telegram',
        error_details: error.message
      });
    });
  });
});

module.exports = router;
