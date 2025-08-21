const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');

const dbPath = path.join(__dirname, '../../payments.db');

// Функция для отправки уведомления в Telegram
async function sendTelegramNotification(botToken, chatId, message) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error.message);
    return false;
  }
}

// Функция для получения всех пользователей с настройками Telegram
function getUsersWithTelegramSettings() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
      SELECT DISTINCT u.id, u.username, us.telegram_bot_token, us.telegram_chat_id, us.reminder_days
      FROM users u
      JOIN user_settings us ON u.id = us.user_id
      WHERE us.telegram_bot_token IS NOT NULL 
      AND us.telegram_chat_id IS NOT NULL
      AND us.telegram_bot_token != ''
      AND us.telegram_chat_id != ''
    `, [], (err, users) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(users);
      }
    });
  });
}

// Функция для получения платежей, требующих уведомления
function getPaymentsForNotification(userId, reminderDays) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    // Получаем все активные платежи (неоплаченные) в диапазоне от сегодня до reminderDays дней вперед
    // и все просроченные платежи
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + reminderDays);
    
    db.all(`
      SELECT p.id, p.title, p.amount, p.due_date, p.payment_date,
             c.name as currency_name, c.symbol as currency_symbol,
             pc.name as category_name, pc.color as category_color,
             pm.name as payment_method_name
      FROM payments p
      LEFT JOIN currencies c ON p.currency_id = c.id
      LEFT JOIN payment_categories pc ON p.category_id = pc.id
      LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
      WHERE p.user_id = ? 
      AND p.payment_date IS NULL
      AND p.due_date <= date(?, '+${reminderDays} days')
      ORDER BY p.due_date ASC
    `, [userId, today.toISOString().split('T')[0]], (err, payments) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(payments);
      }
    });
  });
}



// Функция для форматирования сообщения
function formatNotificationMessage(username, activePayments, reminderDays) {
  let message = `🔔 Уведомление о платежах\n\n👤 Пользователь: ${username}\n\n`;
  
  // Активные платежи
  if (activePayments.length > 0) {
    message += `⏰ Активные платежи:\n`;
    activePayments.forEach(payment => {
      const dueDate = new Date(payment.due_date);
      const today = new Date();
      
      // Сбрасываем время до 00:00:00 для корректного сравнения дат
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const daysUntilDue = Math.ceil((dueDateOnly - todayOnly) / (1000 * 60 * 60 * 24));
      const formattedDate = dueDate.toLocaleDateString('ru-RU');
      const currencySymbol = payment.currency_symbol || '₽';
      const categoryName = payment.category_name || 'Другое';
      const paymentMethod = payment.payment_method_name || 'Не указан';
      
      message += `📋 ${payment.title}\n`;
      message += `   💰 ${payment.amount} ${currencySymbol}\n`;
      message += `   🏷️ ${categoryName}\n`;
      message += `   💳 ${paymentMethod}\n`;
      message += `   📅 ${formattedDate}\n`;
      
      // Показываем количество дней до оплаты или статус
      if (daysUntilDue > 0) {
        message += `   ⏰ До оплаты: ${daysUntilDue} ${daysUntilDue === 1 ? 'день' : daysUntilDue < 5 ? 'дня' : 'дней'}\n`;
      } else if (daysUntilDue === 0) {
        message += `   ⚠️ Оплата сегодня!\n`;
      } else {
        message += `   🚨 Просрочен на ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'день' : Math.abs(daysUntilDue) < 5 ? 'дня' : 'дней'}\n`;
      }
      message += '\n';
    });
  }
  
  if (activePayments.length === 0) {
    message += `✅ У вас нет активных платежей, требующих внимания.`;
  }
  
  return message;
}

// Функция для проверки и отправки уведомлений конкретному пользователю
async function checkAndSendNotificationsForUser(userId, botToken, chatId, reminderDays) {
  try {
    console.log(`🔍 Проверка платежей для пользователя ${userId}: ${new Date().toLocaleString('ru-RU')}`);
    
    // Получаем все активные платежи пользователя
    const activePayments = await getPaymentsForNotification(userId, reminderDays);
    
    if (activePayments.length > 0) {
      // Получаем имя пользователя для сообщения
      const db = new sqlite3.Database(dbPath);
      const username = await new Promise((resolve, reject) => {
        db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
          db.close();
          if (err) reject(err);
          else resolve(user?.username || 'Пользователь');
        });
      });
      
      const message = formatNotificationMessage(username, activePayments, reminderDays);
      
      // Отправляем уведомление
      const success = await sendTelegramNotification(botToken, chatId, message);
      
      if (success) {
        console.log(`✅ Уведомление отправлено пользователю ${username}`);
        return { success: true, payments_count: activePayments.length, message: 'Уведомление отправлено успешно' };
      } else {
        console.log(`❌ Ошибка отправки уведомления пользователю ${username}`);
        return { success: false, error: 'Ошибка отправки в Telegram' };
      }
    } else {
      console.log(`ℹ️ Пользователь ${userId}: нет платежей для уведомления`);
      return { success: true, payments_count: 0, message: 'Нет платежей для уведомления' };
    }
  } catch (error) {
    console.error(`❌ Ошибка проверки уведомлений для пользователя ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Основная функция проверки и отправки уведомлений
async function checkAndSendNotifications() {
  try {
    console.log(`🔍 Проверка платежей: ${new Date().toLocaleString('ru-RU')}`);
    
    // Получаем всех пользователей с настройками Telegram
    const users = await getUsersWithTelegramSettings();
    console.log(`Найдено ${users.length} пользователей с настройками Telegram`);
    
    for (const user of users) {
      try {
        // Получаем все активные платежи (включая просроченные)
        const activePayments = await getPaymentsForNotification(user.id, user.reminder_days || 3);
        
        // Если есть что уведомлять
        if (activePayments.length > 0) {
          const message = formatNotificationMessage(
            user.username, 
            activePayments, 
            user.reminder_days || 3
          );
          
          // Отправляем уведомление
          const success = await sendTelegramNotification(
            user.telegram_bot_token, 
            user.telegram_chat_id, 
            message
          );
          
          if (success) {
            console.log(`✅ Уведомление отправлено пользователю ${user.username}`);
          } else {
            console.log(`❌ Ошибка отправки уведомления пользователю ${user.username}`);
          }
        } else {
          console.log(`ℹ️ Пользователь ${user.username}: нет платежей для уведомления`);
        }
      } catch (error) {
        console.error(`❌ Ошибка обработки пользователя ${user.username}:`, error.message);
      }
    }
    
    console.log(`✅ Проверка завершена: ${new Date().toLocaleString('ru-RU')}`);
  } catch (error) {
    console.error('❌ Критическая ошибка в демоне уведомлений:', error.message);
  }
}

// Запускаем демон каждое утро в 09:00
function startNotificationDaemon() {
  console.log('🚀 Демон уведомлений о платежах запущен');
  console.log('⏰ Расписание: каждое утро в 09:00');
  
  // Запускаем по расписанию
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ Запуск проверки по расписанию');
    checkAndSendNotifications();
  }, {
    scheduled: true,
    timezone: "Europe/Moscow"
  });
  
  // Для тестирования можно запустить сразу
  // checkAndSendNotifications();
}

// Если файл запущен напрямую
if (require.main === module) {
  startNotificationDaemon();
}

module.exports = {
  startNotificationDaemon,
  checkAndSendNotifications,
  checkAndSendNotificationsForUser
};
