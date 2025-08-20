const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../payments.db');
const db = new sqlite3.Database(dbPath);

console.log('Исправляем регулярные платежи...');

db.serialize(() => {
  // Находим все платежи с end_date
  db.all(`
    SELECT * FROM payments 
    WHERE end_date IS NOT NULL
    ORDER BY due_date ASC
  `, [], (err, recurringPayments) => {
    if (err) {
      console.error('Ошибка получения регулярных платежей:', err);
      db.close();
      return;
    }

    console.log(`Найдено ${recurringPayments.length} регулярных платежей`);

    recurringPayments.forEach((payment, index) => {
      console.log(`Обрабатываем платеж ${index + 1}: ${payment.title} (${payment.due_date} - ${payment.end_date})`);
      
      console.log(`Платеж ${payment.title} имеет end_date: ${payment.end_date}`);
      // Логика создания периодических платежей убрана - теперь все создается вручную
    });

    // Ждем завершения всех операций
    setTimeout(() => {
      console.log('Исправление завершено');
      db.close();
    }, 2000);
  });
});
