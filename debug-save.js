require('dotenv').config();
const HouseMappingService = require('./services/HouseMappingService');

async function debug() {
  console.log('--- Тест сохранения маппинга ---');
  try {
    const res = await HouseMappingService.saveMapping({
      sheet_house_name: 'Тестовый дом ' + Date.now(),
      sheet_city_name: 'Астана',
      db_house_ids: [1, 2, 3],
      is_ignored: false
    });
    console.log('✅ Успех:', res);
  } catch (e) {
    console.error('❌ Ошибка при сохранении:');
    console.error(e);
  } finally {
    process.exit();
  }
}

debug();
