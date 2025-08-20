const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../../payments.db');
const db = new sqlite3.Database(dbPath);

console.log('Инициализация базы данных...');

db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица платежей
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
    frequency TEXT DEFAULT 'once' CHECK(frequency IN ('once', 'daily', 'weekly', 'monthly', 'yearly')),
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Таблица истории платежей
  db.run(`CREATE TABLE IF NOT EXISTS payment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments (id)
  )`);

  // Таблица настроек пользователя
  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    reminder_days INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Создаем индексы для оптимизации
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payment_history_payment_id ON payment_history(payment_id)');

  console.log('Таблицы созданы успешно');

  // Создаем тестовых пользователей последовательно
  createUsersSequentially();
  
  function createUsersSequentially() {
    const users = [
      { username: 'admin', password: 'admin123', name: 'Администратор' },
      { username: 'ast', password: '111111', name: 'Алексей' }
    ];
    
    let currentIndex = 0;
    
    function createNextUser() {
      if (currentIndex >= users.length) {
        // Все пользователи созданы, закрываем базу
        db.close((err) => {
          if (err) {
            console.error('Ошибка при закрытии БД:', err);
          } else {
            console.log('База данных инициализирована успешно');
          }
        });
        return;
      }
      
      const userData = users[currentIndex];
      console.log(`Проверяю пользователя: ${userData.username}`);
      
      // Проверяем существование пользователя
      db.get('SELECT id FROM users WHERE username = ?', [userData.username], (err, row) => {
        if (err) {
          console.error('Ошибка при проверке пользователя:', err);
          currentIndex++;
          createNextUser();
          return;
        }
        
        if (row) {
          console.log(`Пользователь ${userData.username} уже существует`);
          currentIndex++;
          createNextUser();
        } else {
          // Создаем пользователя
          const hashedPassword = bcrypt.hashSync(userData.password, 10);
          db.run('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', 
            [userData.username, hashedPassword, userData.name], (err) => {
            if (err) {
              console.error('Ошибка при создании пользователя:', err);
              currentIndex++;
              createNextUser();
              return;
            }
            
            console.log(`Пользователь создан: ${userData.username} / ${userData.password}`);
            
            // Получаем ID созданного пользователя
            db.get('SELECT last_insert_rowid() as id', [], (err, result) => {
              if (err) {
                console.error('Ошибка получения ID пользователя:', err);
                currentIndex++;
                createNextUser();
                return;
              }
              
              const userId = result.id;
              
              // Создаем настройки для пользователя
              db.run('INSERT INTO user_settings (user_id, telegram_bot_token, telegram_chat_id, reminder_days) VALUES (?, ?, ?, ?)', 
                [userId, null, null, 3], (err) => {
                if (err) {
                  console.error('Ошибка создания настроек:', err);
                } else {
                  console.log(`Настройки созданы для пользователя ${userData.username}`);
                }
                
                // Переходим к следующему пользователю
                currentIndex++;
                createNextUser();
              });
            });
          });
        }
      });
    }
    
    // Начинаем создание
    createNextUser();
  }
});
