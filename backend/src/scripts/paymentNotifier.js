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
    
    // Получаем платежи, которые нужно оплатить через reminderDays дней
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + reminderDays);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    db.all(`
      SELECT id, title, amount, due_date, status
      FROM payments 
      WHERE user_id = ? 
      AND status = 'pending'
      AND due_date = ?
      ORDER BY due_date ASC
    `, [userId, targetDateStr], (err, payments) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(payments);
      }
    });
  });
}

// Функция для получения просроченных платежей
function getOverduePayments(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.all(`
      SELECT id, title, amount, due_date, status
      FROM payments 
      WHERE user_id = ? 
      AND status = 'overdue'
      ORDER BY due_date ASC
    `, [userId], (err, payments) => {
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
function formatNotificationMessage(username, upcomingPayments, overduePayments, reminderDays) {
  let message = `🔔 Уведомление о платежах\n\n👤 Пользователь: ${username}\n\n`;
  
  // Предстоящие платежи
  if (upcomingPayments.length > 0) {
    message += `⏰ Через ${reminderDays} ${reminderDays === 1 ? 'день' : reminderDays < 5 ? 'дня' : 'дней'} предстоит оплата:\n`;
    upcomingPayments.forEach(payment => {
      const dueDate = new Date(payment.due_date);
      const formattedDate = dueDate.toLocaleDateString('ru-RU');
      message += `📋 ${payment.title} - ${payment.amount} ₽ (${formattedDate})\n`;
    });
    message += '\n';
  }
  
  // Просроченные платежи
  if (overduePayments.length > 0) {
    message += `🚨 Просроченные платежи:\n`;
    overduePayments.forEach(payment => {
      const dueDate = new Date(payment.due_date);
      const formattedDate = dueDate.toLocaleDateString('ru-RU');
      const daysOverdue = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));
      message += `📋 ${payment.title} - ${payment.amount} ₽ (${formattedDate}, просрочен на ${daysOverdue} ${daysOverdue === 1 ? 'день' : daysOverdue < 5 ? 'дня' : 'дней'})\n`;
    });
  }
  
  if (upcomingPayments.length === 0 && overduePayments.length === 0) {
    message += `✅ У вас нет платежей, требующих внимания в ближайшие ${reminderDays} дней.`;
  }
  
  return message;
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
        // Получаем предстоящие платежи
        const upcomingPayments = await getPaymentsForNotification(user.id, user.reminder_days || 3);
        
        // Получаем просроченные платежи
        const overduePayments = await getOverduePayments(user.id);
        
        // Если есть что уведомлять
        if (upcomingPayments.length > 0 || overduePayments.length > 0) {
          const message = formatNotificationMessage(
            user.username, 
            upcomingPayments, 
            overduePayments, 
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
  checkAndSendNotifications
};
