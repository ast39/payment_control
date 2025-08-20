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

  console.log('=== ПОСЕВ ПЛАТЕЖЕЙ ===');
  console.log('Пользователь:', userId);
  console.log('Источник:', `${sourceMonth}/${sourceYear}`);
  console.log('Цель:', `${targetMonth}/${targetYear}`);
  console.log('Типы данных:', {
    sourceMonth: typeof sourceMonth,
    sourceYear: typeof sourceYear,
    targetMonth: typeof targetMonth,
    targetYear: typeof targetYear
  });

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
    SELECT title, description, amount
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

  console.log('SQL запрос источника:', sourceQuery);
  console.log('Параметры источника:', sourceParams);

  db.all(sourceQuery, sourceParams, (err, sourcePayments) => {
    if (err) {
      console.error('Ошибка получения платежей источника:', err);
      db.close();
      return res.status(500).json({
        error: 'Ошибка базы данных',
        message: 'Не удалось получить платежи для копирования'
      });
    }

    console.log('Найдено платежей для копирования:', sourcePayments.length);

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
      INSERT INTO payments (user_id, title, description, amount, payment_date, due_date, created_at)
      VALUES (?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
    `;
    
    console.log('=== НАЧИНАЕМ КОПИРОВАНИЕ ===');
    console.log('Всего платежей для копирования:', sourcePayments.length);
    console.log('Дней в целевом месяце:', daysInTargetMonth);

    sourcePayments.forEach((payment, index) => {
      // Получаем исходный день из исходного месяца
      const sourceQuery = `
        SELECT due_date FROM payments 
        WHERE user_id = ? AND title = ? AND description = ? AND amount = ?
        AND substr(due_date, 1, 4) = ? AND substr(due_date, 6, 2) = ?
        LIMIT 1
      `;
      
      const sourceParams = [
        userId, 
        payment.title, 
        payment.description, 
        payment.amount,
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
        
        // Если день был изменен, логируем это
        if (adjustedDay !== sourceDay) {
          console.log(`День ${sourceDay} не существует в целевом месяце, используем ${adjustedDay}`);
        }
        
        // Создаем дату в целевом месяце (ВАЖНО: месяцы в JS начинаются с 0)
        // Но targetMonth уже приходит как 1-12, поэтому -1 для JS
        const targetDueDate = new Date(targetYear, targetMonth - 1, adjustedDay);
        
        // Форматируем дату правильно (YYYY-MM-DD)
        const year = targetDueDate.getFullYear();
        const month = String(targetDueDate.getMonth() + 1).padStart(2, '0'); // +1 потому что JS месяцы 0-11
        const day = String(targetDueDate.getDate()).padStart(2, '0');
        const formattedTargetDate = `${year}-${month}-${day}`;
        
        console.log(`Дата: ${sourcePayment.due_date} (день ${sourceDay}) → ${formattedTargetDate} (день ${adjustedDay})`);
        console.log(`targetYear: ${targetYear}, targetMonth: ${targetMonth}, adjustedDay: ${adjustedDay}`);
        console.log(`JS Date: ${targetDueDate.toISOString()}`);
        console.log(`Форматированная: ${formattedTargetDate}`);

              const insertParams = [
          userId,
          payment.title,
          payment.description,
          payment.amount,
          formattedTargetDate
        ];

        console.log(`Копируем платеж ${index + 1}:`, {
          title: payment.title,
          amount: payment.amount,
          sourceDay: sourceDay,
          adjustedDay: adjustedDay,
          targetDate: formattedTargetDate,
          daysInTargetMonth: daysInTargetMonth
        });

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

            console.log('=== ПОСЕВ ЗАВЕРШЕН ===');
            console.log('Успешно посеяно платежей:', seededCount);
            
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
