const readline = require('readline');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const dbPath = path.join(__dirname, '../../payments.db');

console.log('🔐 Создание нового пользователя\n');

rl.question('Введите логин: ', (username) => {
  rl.question('Введите пароль: ', (password) => {
    rl.question('Введите имя: ', (name) => {
      if (!username || !password || !name) {
        console.log('❌ Все поля обязательны!');
        rl.close();
        return;
      }

      if (password.length < 6) {
        console.log('❌ Пароль должен быть не менее 6 символов!');
        rl.close();
        return;
      }

      const db = new sqlite3.Database(dbPath);

      // Проверяем, существует ли пользователь
      db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
        if (err) {
          console.error('❌ Ошибка базы данных:', err.message);
          db.close();
          rl.close();
          return;
        }

        if (existingUser) {
          console.log('❌ Пользователь с таким логином уже существует!');
          db.close();
          rl.close();
          return;
        }

        // Хешируем пароль
        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
            console.error('❌ Ошибка хеширования пароля:', err.message);
            db.close();
            rl.close();
            return;
          }

          // Создаем пользователя
          db.run('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', 
            [username, hashedPassword, name], function(err) {
            if (err) {
              console.error('❌ Ошибка создания пользователя:', err.message);
              db.close();
              rl.close();
              return;
            }

            const userId = this.lastID;

                    // Создаем настройки по умолчанию
        db.run('INSERT INTO user_settings (user_id, telegram_bot_token, telegram_chat_id, reminder_days) VALUES (?, ?, ?, ?)', 
          [userId, null, null, 3], (err) => {
              if (err) {
                console.error('⚠️  Ошибка создания настроек:', err.message);
              }
              
              db.close();
              console.log('\n✅ Пользователь создан успешно!');
              console.log(`📋 ID: ${userId}`);
              console.log(`👤 Логин: ${username}`);
              console.log(`📝 Имя: ${name}`);
              console.log('\n🔑 Теперь вы можете войти в систему');
              rl.close();
            });
          });
        });
      });
    });
  });
});
