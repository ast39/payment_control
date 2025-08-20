const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../payments.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Запуск миграции базы данных...');

db.serialize(() => {
  // Проверяем, есть ли поле description в таблице payments
  db.get("PRAGMA table_info(payments)", (err, rows) => {
    if (err) {
      console.error('Ошибка проверки структуры таблицы payments:', err);
      return;
    }
    
    db.all("PRAGMA table_info(payments)", (err, columns) => {
      if (err) {
        console.error('Ошибка получения информации о таблице payments:', err);
        return;
      }
      
      const hasDescription = columns.some(col => col.name === 'description');
      
      if (!hasDescription) {
        console.log('➕ Добавляю поле description в таблицу payments...');
        db.run('ALTER TABLE payments ADD COLUMN description TEXT', (err) => {
          if (err) {
            console.error('Ошибка добавления поля description:', err);
          } else {
            console.log('✅ Поле description добавлено в таблицу payments');
          }
        });
      } else {
        console.log('✅ Поле description уже существует в таблице payments');
      }
    });
  });

  // Проверяем, есть ли поле telegram_bot_token в таблице user_settings
  db.get("PRAGMA table_info(user_settings)", (err, rows) => {
    if (err) {
      console.error('Ошибка проверки структуры таблицы user_settings:', err);
      return;
    }
    
    db.all("PRAGMA table_info(user_settings)", (err, columns) => {
      if (err) {
        console.error('Ошибка получения информации о таблице user_settings:', err);
        return;
      }
      
      const hasBotToken = columns.some(col => col.name === 'telegram_bot_token');
      
      if (!hasBotToken) {
        console.log('➕ Добавляю поле telegram_bot_token в таблицу user_settings...');
        db.run('ALTER TABLE user_settings ADD COLUMN telegram_bot_token TEXT', (err) => {
          if (err) {
            console.error('Ошибка добавления поля telegram_bot_token:', err);
          } else {
            console.log('✅ Поле telegram_bot_token добавлено в таблицу user_settings');
          }
        });
      } else {
        console.log('✅ Поле telegram_bot_token уже существует в таблице user_settings');
      }
    });
  });

  // Обновляем существующие записи, добавляя значения по умолчанию
  setTimeout(() => {
    console.log('🔄 Обновляю существующие записи...');
    
    // Обновляем настройки пользователей, добавляя telegram_bot_token если его нет
    db.run(`
      UPDATE user_settings 
      SET telegram_bot_token = COALESCE(telegram_bot_token, NULL)
      WHERE telegram_bot_token IS NULL
    `, (err) => {
      if (err) {
        console.error('Ошибка обновления user_settings:', err);
      } else {
        console.log('✅ Существующие настройки обновлены');
      }
    });

    // Обновляем платежи, добавляя description если его нет
    db.run(`
      UPDATE payments 
      SET description = COALESCE(description, NULL)
      WHERE description IS NULL
    `, (err) => {
      if (err) {
        console.error('Ошибка обновления payments:', err);
      } else {
        console.log('✅ Существующие платежи обновлены');
      }
    });

    // Закрываем соединение после завершения
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('Ошибка при закрытии БД:', err);
        } else {
          console.log('✅ Миграция завершена успешно');
        }
      });
    }, 1000);
  }, 2000);
});
