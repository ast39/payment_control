const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../payments.db');
const db = new sqlite3.Database(dbPath);

console.log('Исправляем регулярные платежи...');

db.serialize(() => {
  // Находим все регулярные платежи
  db.all(`
    SELECT * FROM payments 
    WHERE frequency != 'once' AND end_date IS NOT NULL
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
      
      const startDate = new Date(payment.due_date);
      const endDate = new Date(payment.end_date);
      let currentDate = new Date(startDate);
      
      // Пропускаем первую дату, так как основной платеж уже существует
      switch (payment.frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }

      const createMissingPayments = () => {
        if (currentDate > endDate) {
          return;
        }

        // Проверяем, существует ли уже платеж на эту дату
        const dateStr = currentDate.toISOString().split('T')[0];
        db.get(`
          SELECT id FROM payments 
          WHERE user_id = ? AND title = ? AND due_date = ? AND frequency = ?
        `, [payment.user_id, payment.title, dateStr, payment.frequency], (err, existingPayment) => {
          if (err) {
            console.error('Ошибка проверки существующего платежа:', err);
            return;
          }

          if (!existingPayment) {
            // Создаем недостающий платеж
            db.run(`
              INSERT INTO payments (user_id, title, description, amount, payment_date, due_date, frequency, end_date, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [payment.user_id, payment.title, payment.description, payment.amount, 
                dateStr, dateStr, payment.frequency, payment.end_date,
                currentDate < new Date() ? 'overdue' : 'pending'], (err) => {
              if (err) {
                console.error('Ошибка создания недостающего платежа:', err);
              } else {
                console.log(`Создан платеж на ${dateStr}`);
              }
            });
          }

          // Увеличиваем дату согласно периодичности
          switch (payment.frequency) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
          }

          createMissingPayments();
        });
      };

      createMissingPayments();
    });

    // Ждем завершения всех операций
    setTimeout(() => {
      console.log('Исправление завершено');
      db.close();
    }, 2000);
  });
});
