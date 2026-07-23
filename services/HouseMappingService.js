const { remoteDb, localDb } = require('../config/database');

class HouseMappingService {
  /**
   * Получает список домов из основной БД, которые еще не распределены 
   * (не добавлены в house_mappings или добавлены, но не проигнорированы и не привязаны).
   */
  async getUnmappedHouses() {
    // 1. Получаем все маппинги из локальной БД
    const mappings = await localDb('house_mappings').select('db_house_ids', 'is_ignored');
    
    const mappedHouseIds = new Set();
    const ignoredHouseIds = new Set();

    mappings.forEach(mapping => {
      let ids = [];
      if (typeof mapping.db_house_ids === 'string') {
        try {
          ids = JSON.parse(mapping.db_house_ids);
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      } else if (Array.isArray(mapping.db_house_ids)) {
        ids = mapping.db_house_ids;
      }

      if (ids && ids.length > 0) {
        if (mapping.is_ignored) {
          ids.forEach(id => ignoredHouseIds.add(Number(id)));
        } else {
          ids.forEach(id => mappedHouseIds.add(Number(id)));
        }
      }
    });

    const allExcludedIds = [...mappedHouseIds, ...ignoredHouseIds];

    // 2. Получаем дома из удаленной БД, исключая удаленные записи и те, что уже замаплены
    const unmappedHousesQuery = remoteDb('houses')
      .whereNull('deleted_at')
      .select('id', 'title', 'city_id', 'district_id');

    if (allExcludedIds.length > 0) {
      unmappedHousesQuery.whereNotIn('id', allExcludedIds);
    }

    const unmappedHouses = await unmappedHousesQuery;

    return unmappedHouses;
  }

  /**
   * Возвращает замапленные (не проигнорированные) дома для внешнего сервиса
   * проверки экранов: название/город из прайса + массив ID домов из основной БД.
   */
  async getMappedHousesForExport() {
    const mappings = await localDb('house_mappings')
      .where('is_ignored', false)
      .select('sheet_house_name', 'sheet_city_name', 'db_house_ids');

    return mappings
      .map(m => {
        let ids = [];
        try {
          ids = typeof m.db_house_ids === 'string' ? JSON.parse(m.db_house_ids) : (m.db_house_ids || []);
        } catch (e) {
          ids = [];
        }
        return {
          sheet_house_name: m.sheet_house_name,
          sheet_city_name: m.sheet_city_name,
          db_house_ids: (ids || []).map(Number).filter(n => !Number.isNaN(n))
        };
      })
      .filter(h => h.db_house_ids.length > 0);
  }

  /**
   * Сравнивает данные из Google Таблицы с существующими маппингами в базе.
   */
  async getSyncStatus(sheetData) {
    // 1. Получаем все маппинги из локальной БД
    const mappings = await localDb('house_mappings').select('*');

    const result = sheetData.map(sheetItem => {
      // Ищем маппинг по названию из таблицы и городу
      const mapping = mappings.find(m => m.sheet_house_name === sheetItem.sheet_house_name && m.sheet_city_name === sheetItem.sheet_name);
      
      return {
        ...sheetItem,
        is_mapped: !!mapping,
        mapping_id: mapping ? mapping.id : null,
        db_house_ids: mapping ? (typeof mapping.db_house_ids === 'string' ? JSON.parse(mapping.db_house_ids) : mapping.db_house_ids) : [],
        is_ignored: mapping ? !!mapping.is_ignored : false,
        latitude: mapping ? mapping.latitude : null,
        longitude: mapping ? mapping.longitude : null,
        photo_url: mapping ? mapping.photo_url : null
      };
    });

    return result;
  }

  /**
   * Поиск домов в удаленной БД по названию.
   */
  async searchHouses(query) {
    if (!query || query.length < 2) return [];

    const houses = await remoteDb('houses as h')
      .leftJoin('districts as d', 'h.district_id', 'd.id')
      .whereNull('h.deleted_at')
      .where('h.title', 'like', `%${query}%`)
      .select('h.id', 'h.title', 'd.title as district_title')
      .limit(20);

    return houses.map(h => ({
      id: h.id,
      title: h.district_title ? `${h.title} (${h.district_title})` : h.title
    }));
  }

  /**
   * Сохраняет или обновляет маппинг.
   */
  async saveMapping(data) {
    console.log('--- HouseMappingService.saveMapping called ---');
    console.log('Data received:', data);
    
    try {
      const { sheet_house_name, sheet_city_name, db_house_ids, is_ignored, latitude, longitude, photo_url } = data;

      if (!sheet_house_name) {
        throw new Error('sheet_house_name is required');
      }

      // Проверяем, существует ли уже такой маппинг
      const existing = await localDb('house_mappings')
        .where('sheet_house_name', sheet_house_name)
        .where('sheet_city_name', sheet_city_name || '')
        .first();

      const payload = {
        sheet_house_name,
        sheet_city_name: sheet_city_name || '',
        db_house_ids: JSON.stringify(db_house_ids || []),
        is_ignored: !!is_ignored,
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        photo_url: photo_url !== undefined ? photo_url : null,
        updated_at: localDb.fn.now()
      };

      if (existing) {
        console.log('Updating existing mapping:', existing.id);
        await localDb('house_mappings')
          .where('id', existing.id)
          .update(payload);
        
        // Удаляем объекты Raw перед отправкой в JSON, чтобы не было ошибки круговой ссылки
        delete payload.updated_at;
        return { id: existing.id, ...payload, updated: true };
      } else {
        console.log('Inserting new mapping');
        const [id] = await localDb('house_mappings').insert({
          ...payload,
          created_at: localDb.fn.now()
        });
        
        delete payload.updated_at;
        return { id, ...payload, created: true };
      }
    } catch (error) {
      console.error('CRITICAL ERROR in saveMapping:', error);
      throw error;
    }
  }

  /**
   * Удаляет маппинг.
   */
  async deleteMapping(id) {
    return localDb('house_mappings').where('id', id).del();
  }

  /**
   * Генерирует финальный прайс-лист, обогащая данные из Google Sheets 
   * реальными районами и количеством мониторов из БД liftmedia.
   */
  async generateFinalPriceList(sheetData) {
    // 1. Получаем все активные маппинги (не проигнорированные)
    const mappings = await localDb('house_mappings')
      .where('is_ignored', false)
      .select('*');

    // Тестовые дома — исключаем их из прайса
    const testHouseRows = await localDb('test_houses').select('db_house_id');
    const testHouseIds = new Set(testHouseRows.map(t => Number(t.db_house_id)));

    // Фильтруем маппинги: убираем те, у которых все db_house_ids — тестовые
    // (частичное перекрытие — оставляем, убирая только тестовые ID из набора)
    mappings.forEach(m => {
      let ids = [];
      try { ids = JSON.parse(m.db_house_ids); } catch(e){}
      m.parsed_db_ids = ids.filter(id => !testHouseIds.has(Number(id)));
    });

    // 1.5 Получаем маппинги секторов
    const sectorMappings = await localDb('sector_mappings').select('*');
    const sectorMap = {};
    sectorMappings.forEach(sm => {
      let titles = [];
      try { titles = JSON.parse(sm.db_district_titles); } catch(e){}
      sectorMap[`${sm.sheet_name}|${sm.sheet_sector_name}`] = {
        title: titles.join(', ') || sm.db_district_title,
        price: sm.price || 0
      };
    });

    // Собираем все уникальные ID домов из базы (уже без тестовых)
    const allDbHouseIds = new Set();
    mappings.forEach(m => {
      if (Array.isArray(m.parsed_db_ids)) {
        m.parsed_db_ids.forEach(id => allDbHouseIds.add(id));
      }
    });

    const uniqueHouseIds = Array.from(allDbHouseIds);
    if (uniqueHouseIds.length === 0) return [];

    // 2. Считаем активные мониторы (devices) для каждого дома
    const devicesCounts = await remoteDb('devices')
      .whereIn('house_id', uniqueHouseIds)
      .whereNull('deleted_at')
      .select('house_id')
      .count('id as monitor_count')
      .groupBy('house_id');

    const deviceCountMap = {};
    devicesCounts.forEach(d => {
      deviceCountMap[d.house_id] = Number(d.monitor_count);
    });

    // 2.5 Получаем информацию о домах (city_id) из основной БД
    const housesInfo = await remoteDb('houses')
      .whereIn('id', uniqueHouseIds)
      .whereNull('deleted_at')
      .select('id', 'city_id');

    const houseCityMap = {};
    housesInfo.forEach(h => {
      houseCityMap[h.id] = h.city_id;
    });

    // 3. Формируем структуру заявок на дома (многие-ко-многим)
    // Чтобы пропорционально разделить мониторы, если 1 дом БД привязан к >1 строке прайса
    const dbHouseClaims = {}; // db_house_id -> array of sheetItems
    
    // Создаем копии элементов прайса для итогового результата
    const finalItems = sheetData.map(sheetItem => {
      const mapping = mappings.find(m => m.sheet_house_name === sheetItem.sheet_house_name && m.sheet_city_name === sheetItem.sheet_name);
      return {
        ...sheetItem,
        mapping: mapping,
        actual_monitors: 0 // Будем накапливать
      };
    }).filter(item => item.mapping && item.mapping.parsed_db_ids && item.mapping.parsed_db_ids.length > 0);

    finalItems.forEach(item => {
      item.mapping.parsed_db_ids.forEach(dbId => {
        if (!dbHouseClaims[dbId]) dbHouseClaims[dbId] = [];
        dbHouseClaims[dbId].push(item);
      });
    });

    // 4. Распределяем мониторы БД между строками прайса
    for (const [dbIdStr, claimants] of Object.entries(dbHouseClaims)) {
      const dbId = Number(dbIdStr);
      const totalDbMonitors = deviceCountMap[dbId] || 0;
      
      if (totalDbMonitors === 0) continue;

      const totalRequested = claimants.reduce((sum, item) => sum + (item.sheet_monitors || 0), 0);

      let monitorsLeft = totalDbMonitors;

      claimants.forEach((item, index) => {
        let allocation = 0;
        if (index === claimants.length - 1) {
          // Последнему отдаем все остатки, чтобы избежать проблем с округлением
          allocation = monitorsLeft;
        } else {
          if (totalRequested > 0) {
            allocation = Math.round(totalDbMonitors * ((item.sheet_monitors || 0) / totalRequested));
          } else {
            allocation = Math.round(totalDbMonitors / claimants.length);
          }
          monitorsLeft -= allocation;
        }
        item.actual_monitors += allocation;
      });
    }

    // 5. Формируем итоговый список
    const finalPriceList = finalItems.map(item => {
      // Ищем привязанный район для сектора, иначе показываем оригинальный сектор
      const sectorInfo = sectorMap[`${item.sheet_name}|${item.sheet_sector_name}`] || {};
      const dbDistrict = sectorInfo.title || item.sheet_sector_name || 'Неизвестный сектор';

      // Находим city_id по привязанным домам из БД
      const mappedDbIds = item.mapping ? item.mapping.parsed_db_ids : [];
      let cityId = null;
      if (mappedDbIds && mappedDbIds.length > 0) {
        for (const dbId of mappedDbIds) {
          if (houseCityMap[dbId] !== undefined) {
            cityId = houseCityMap[dbId];
            break;
          }
        }
      }

      return {
        sheet_name: item.sheet_name,
        sheet_sector_name: item.sheet_sector_name,
        db_district: dbDistrict,
        sheet_house_name: item.sheet_house_name,
        sheet_address: item.sheet_address,
        original_monitors: item.sheet_monitors,
        actual_monitors: item.actual_monitors,
        entrances: item.sheet_entrances,
        floors: item.sheet_floors,
        apartments: item.sheet_apartments,
        price: sectorInfo.price || 0,
        is_bc: item.sheet_name.toLowerCase().includes('bc') || item.sheet_name.toLowerCase().includes('бц'),
        city_id: cityId,
        latitude: item.mapping ? item.mapping.latitude : null,
        longitude: item.mapping ? item.mapping.longitude : null,
        photo_url: item.mapping ? item.mapping.photo_url : null,
        monitors_lift: item.sheet_monitors_lift !== undefined ? item.sheet_monitors_lift : item.sheet_monitors,
        monitors_hall: item.sheet_monitors_hall !== undefined ? item.sheet_monitors_hall : 0,
        db_house_ids: mappedDbIds
      };
    });

    return finalPriceList;
  }

  /**
   * Получает занятость домов на указанный период по медиапланам из удаленной БД.
   */
  async getOccupancy(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) {
      return {};
    }

    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      // Форматируем даты для корректного сравнения в SQL
      const startDateFormatted = startDate.toISOString().split('T')[0] + ' 00:00:00';
      const endDateFormatted = endDate.toISOString().split('T')[0] + ' 23:59:59';

      // 1. Находим все активные неудаленные медиапланы, пересекающиеся с выбранным периодом
      const plans = await remoteDb('mediaplans as mp')
        .leftJoin('customers as c', 'mp.customer_id', 'c.id')
        .where('mp.active', 1)
        .whereNull('mp.deleted_at')
        .where('mp.date_from', '<=', endDateFormatted)
        .where('mp.date_to', '>=', startDateFormatted)
        .select(
          'mp.id',
          'mp.customer_id',
          'c.title as customer_title',
          'mp.contract_number',
          'mp.date_from',
          'mp.date_to'
        );

      if (plans.length === 0) {
        return {};
      }

      const planIds = plans.map(p => p.id);

      // 2. Получаем видеоролики для этих медиапланов
      const planVideos = await remoteDb('mediaplanvideorecords as mpv')
        .join('videorecords as vr', 'mpv.videorecord_id', 'vr.id')
        .whereNull('vr.deleted_at')
        .whereIn('mpv.mediaplan_id', planIds)
        .select('mpv.mediaplan_id', 'vr.id as video_id', 'vr.title as video_title', 'vr.duration');

      const videosByPlan = {};
      planVideos.forEach(v => {
        if (!videosByPlan[v.mediaplan_id]) {
          videosByPlan[v.mediaplan_id] = [];
        }
        videosByPlan[v.mediaplan_id].push({
          id: v.video_id,
          title: v.video_title,
          duration: v.duration
        });
      });

      // 3. Получаем районы (сектора) для этих медиапланов
      const planDistricts = await remoteDb('mediaplandistricts')
        .whereIn('mediaplan_id', planIds)
        .select('mediaplan_id', 'district_id');

      const planDistrictsMap = {};
      planDistricts.forEach(pd => {
        if (!planDistrictsMap[pd.mediaplan_id]) {
          planDistrictsMap[pd.mediaplan_id] = new Set();
        }
        planDistrictsMap[pd.mediaplan_id].add(pd.district_id);
      });

      // 4. Получаем дома-исключения для этих медиапланов
      const planExceptions = await remoteDb('mediaplanexceptionhouses')
        .whereIn('mediaplan_id', planIds)
        .select('mediaplan_id', 'house_id');

      const planExceptionsMap = {};
      planExceptions.forEach(pe => {
        if (!planExceptionsMap[pe.mediaplan_id]) {
          planExceptionsMap[pe.mediaplan_id] = new Set();
        }
        planExceptionsMap[pe.mediaplan_id].add(pe.house_id);
      });

      // 5. Получаем все дома с их районами из БД
      const houses = await remoteDb('houses')
        .whereNull('deleted_at')
        .select('id', 'district_id');

      const occupancyMap = {};

      houses.forEach(house => {
        const houseId = house.id;
        const districtId = house.district_id;

        plans.forEach(plan => {
          const planId = plan.id;
          const hasDistrict = planDistrictsMap[planId] && planDistrictsMap[planId].has(districtId);
          const isExcluded = planExceptionsMap[planId] && planExceptionsMap[planId].has(houseId);

          if (hasDistrict && !isExcluded) {
            if (!occupancyMap[houseId]) {
              occupancyMap[houseId] = [];
            }
            occupancyMap[houseId].push({
              plan_id: planId,
              customer_title: plan.customer_title || 'Неизвестный клиент',
              contract_number: plan.contract_number || '',
              date_from: plan.date_from,
              date_to: plan.date_to,
              videos: videosByPlan[planId] || []
            });
          }
        });
      });

      return occupancyMap;
    } catch (err) {
      console.error('Error calculating occupancy:', err);
      throw err;
    }
  }
}

module.exports = new HouseMappingService();
