const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const dbPath = path.join(__dirname, '../../payments.db');

// Защищаем все роуты seeding
router.use(authenticateToken);

// Посев платежей (копирование между месяцами)
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { sourceMonth, sourceYear, targetMonth, targetYear } = req.body;
  const db = new sqlite3.Database(dbPath);

  // Валидация входных данных
  if (!sourceMonth || !sourceYear || !targetMonth || !targetYear) {
    db.close();
    return res.status(400).json({
      error: 'Неверные данные',
      message: 'Все поля обязательны: sourceMonth, sourceYear, targetMonth, targetYear'
    });
  }

  // Проверяем что месяцы в диапазоне 1-12
  if (sourceMonth < 1 || sourceMonth > 12 || targetMonth < 1 || targetMonth > 12) {
    db.close();
    return res.status(400).json({
      error: 'Неверные данные',
      message: 'Месяц должен быть от 1 до 12'
    });
  }

  // Получаем платежи из исходного месяца (ВСЕ платежи)
  const sourceQuery = `
    SELECT title, description, amount, currency_id, category_id, payment_method_id
    FROM payments
    WHERE user_id = ? 
      AND substr(due_date, 1, 4) = ? 
      AND substr(due_date, 6, 2) = ?
  `;

  const sourceParams = [
    userId, 
    sourceYear.toString(), 
    sourceMonth.toString().padStart(2, '0')
  ];

  db.all(sourceQuery, sourceParams, (err, sourcePayments) => {
    if (err) {
      console.error('Ошибка получения платежей источника:', err);
      db.close();
      return res.status(500).json({
        error: 'Ошибка базы данных',
        message: 'Не удалось получить платежи для копирования'
      });
    }

    if (sourcePayments.length === 0) {
      db.close();
      return res.status(400).json({
        error: 'Нет платежей для копирования',
        message: 'В указанном месяце нет неоплаченных платежей'
      });
    }

    // Генерируем даты для целевого месяца
    const targetDate = new Date(targetYear, targetMonth - 1, 1);
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

    // Копируем каждый платеж
    let seededCount = 0;
    let errorCount = 0;

    const insertQuery = `
      INSERT INTO payments (user_id, title, description, amount, currency_id, category_id, payment_method_id, payment_date, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
    `;
    
    sourcePayments.forEach((payment, index) => {
      // Получаем исходный день из исходного месяца
      const sourceQuery = `
        SELECT due_date FROM payments 
        WHERE user_id = ? AND title = ? AND description = ? AND amount = ? AND currency_id = ? AND category_id = ? AND payment_method_id = ?
        AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?
        LIMIT 1
      `;
      
      const sourceParams = [
        userId, 
        payment.title, 
        payment.description, 
        payment.amount,
        payment.currency_id || 1,
        payment.category_id || 1,
        payment.payment_method_id || 1,
        sourceYear.toString(),
        sourceMonth.toString().padStart(2, '0')
      ];
      
      // Получаем исходную дату для определения дня месяца
      db.get(sourceQuery, sourceParams, (err, sourcePayment) => {
        if (err) {
          console.error(`Ошибка получения исходной даты для ${payment.title}:`, err);
          errorCount++;
          return;
        }
        
        if (!sourcePayment) {
          console.error(`Не найдена исходная дата для ${payment.title}`);
          errorCount++;
          return;
        }
        
        // Извлекаем день из исходной даты
        const sourceDay = parseInt(sourcePayment.due_date.split('-')[2]);
        
        // Копируем на тот же день в целевом месяце
        let adjustedDay = sourceDay;
        
        // Если день больше чем дней в целевом месяце, 
        // минусуем на 1 день пока не дойдем до существующего
        while (adjustedDay > daysInTargetMonth) {
          adjustedDay--;
        }
        

        
        // Создаем дату в целевом месяце (ВАЖНО: месяцы в JS начинаются с 0)
        // Но targetMonth уже приходит как 1-12, поэтому -1 для JS
        const targetDueDate = new Date(targetYear, targetMonth - 1, adjustedDay);
        
        // Форматируем дату правильно (YYYY-MM-DD)
        const year = targetDueDate.getFullYear();
        const month = String(targetDueDate.getMonth() + 1).padStart(2, '0'); // +1 потому что JS месяцы 0-11
        const day = String(targetDueDate.getDate()).padStart(2, '0');
        const formattedTargetDate = `${year}-${month}-${day}`;
        


              const insertParams = [
          userId,
          payment.title,
          payment.description,
          payment.amount,
          payment.currency_id || 1,
          payment.category_id || 1,
          payment.payment_method_id || 1,
          formattedTargetDate
        ];

        db.run(insertQuery, insertParams, function(err) {
          if (err) {
            console.error(`Ошибка копирования платежа ${index + 1}:`, err);
            errorCount++;
          } else {
            seededCount++;
            console.log(`Успешно скопирован платеж ${index + 1}, ID:`, this.lastID);
          }

          // Проверяем что все платежи обработаны
          if (seededCount + errorCount === sourcePayments.length) {
            db.close();
            
            if (errorCount > 0) {
              return res.status(500).json({
                error: 'Ошибка посева',
                message: `Посеяно ${seededCount} платежей, ошибок: ${errorCount}`
              });
            }

            res.json({
              success: true,
              message: 'Платежи успешно посеяны',
              seeded_count: seededCount,
              source_month: `${sourceMonth}/${sourceYear}`,
              target_month: `${targetMonth}/${targetYear}`
            });
          }
        });
      });
    });
  });
});

module.exports = router;
