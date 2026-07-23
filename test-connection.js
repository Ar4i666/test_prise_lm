require('dotenv').config();
const { remoteDb } = require('./config/database');

async function testConnection() {
  console.log('🔄 Попытка подключения к удаленной БД через туннель...');
  
  try {
    // Простой тестовый запрос, чтобы проверить жива ли база
    await remoteDb.raw('SELECT 1+1 AS result');
    console.log('✅ Подключение к MySQL успешно установлено!');
    
    // Проверка прав на чтение конкретной таблицы
    console.log('🔄 Проверяем доступ к таблице houses...');
    const houses = await remoteDb('houses').select('id', 'title').limit(3);
    
    console.log(`✅ Доступ к таблице есть. Успешно прочитано ${houses.length} записи(ей):`);
    console.log(houses);

  } catch (err) {
    console.error('❌ Ошибка подключения или доступа:');
    console.error(err.message);
    
    console.log('\n💡 Подсказка: убедитесь, что:');
    console.log('1. Команда туннеля (ssh -N -L ...) сейчас запущена в другом окне терминала.');
    console.log('2. В файле .env указаны правильные логин/пароль и порт 3306 (или 3307).');
  } finally {
    // Обязательно закрываем соединение, чтобы скрипт завершился
    await remoteDb.destroy();
  }
}

testConnection();
