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

  // Таблица валют
  db.run(`CREATE TABLE IF NOT EXISTS currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    symbol TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица категорий платежей
  db.run(`CREATE TABLE IF NOT EXISTS payment_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица способов оплаты
  db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица платежей (обновленная)
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency_id INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER NOT NULL DEFAULT 1,
    payment_method_id INTEGER NOT NULL DEFAULT 1,
    payment_date DATE,
    due_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (currency_id) REFERENCES currencies (id),
    FOREIGN KEY (category_id) REFERENCES payment_categories (id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id)
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
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_currency_id ON payments(currency_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_category_id ON payments(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_payment_method_id ON payments(payment_method_id)');

  console.log('Таблицы созданы успешно');

  // Создаем базовые данные
  createBaseData();
});

function createBaseData() {
  // Создаем валюты
  const currencies = [
    { name: 'Российский рубль', code: 'RUB', symbol: '₽' },
    { name: 'Доллар США', code: 'USD', symbol: '$' },
    { name: 'Евро', code: 'EUR', symbol: '€' }
  ];

  currencies.forEach(currency => {
    db.run('INSERT OR IGNORE INTO currencies (name, code, symbol) VALUES (?, ?, ?)', 
      [currency.name, currency.code, currency.symbol]);
  });

  // Создаем категории
  const categories = [
    { name: 'Другое', color: '#6B7280' },
    { name: 'Кредиты', color: '#EF4444' },
    { name: 'Подписки', color: '#3B82F6' }
  ];

  categories.forEach(category => {
    db.run('INSERT OR IGNORE INTO payment_categories (name, color) VALUES (?, ?)', 
      [category.name, category.color]);
  });

  // Создаем способы оплаты
  const paymentMethods = [
    { name: 'Наличные' },
    { name: 'Карта' },
    { name: 'Перевод' }
  ];

  paymentMethods.forEach(method => {
    db.run('INSERT OR IGNORE INTO payment_methods (name) VALUES (?)', 
      [method.name]);
  });

  console.log('Базовые данные созданы успешно');

  // Создаем тестовых пользователей
  createUsersSequentially();
}

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
