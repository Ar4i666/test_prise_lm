const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const SmetaExcel = require('../public/smeta-excel.js');
const { localDb } = require('../config/database');
const { uploadFileToNextcloud, createPublicShareLink } = require('./nextcloud');

// ─────────────────────────────────────────────────────────
// Собирает КП (смета в Excel) из выбранных секторов и заливает в
// Nextcloud — серверный эквивалент того, что раньше делала кнопка
// "Скачать смету" в public/index.html (см. её обработчик клика для
// исходной группировки/форматирования, которую этот сервис повторяет).
// ─────────────────────────────────────────────────────────

function isBcSheetName(name) {
  const n = (name || '').toLowerCase();
  return n.includes('bc') || n.includes('бц');
}

function baseCityName(sheetName) {
  const n = (sheetName || '').replace(/^BC\s+/i, '').trim();
  if (/astana/i.test(n)) return 'Астана';
  if (/almaty/i.test(n)) return 'Алматы';
  return n;
}

function displaySectorName(sheetSectorName, isBC) {
  let n = (sheetSectorName || '')
    .replace(/^(BC Astana|BC Almaty|Astana|Almaty)\s*[\-—–]?\s*/i, '')
    .trim();
  if (isBC) return /^бц/i.test(n) ? n : 'БЦ ' + n;
  return /^жк/i.test(n) ? n : 'ЖК ' + n;
}

// Читает картинки (логотип + фото мониторов) с диска, а не по HTTP —
// на сервере это надёжнее, чем самому себе делать fetch().
function loadMediaFromDisk() {
  const files = {
    logo: 'smeta-logo.png',
    img156: 'smeta-monitor-156.png',
    img215: 'smeta-monitor-215.png',
    img43: 'smeta-monitor-43.png',
  };
  const media = {};
  for (const key of Object.keys(files)) {
    const filePath = path.join(__dirname, '..', 'public', files[key]);
    if (fs.existsSync(filePath)) {
      media[key] = { buffer: fs.readFileSync(filePath), extension: 'png' };
    }
  }
  return media;
}

// priceList — плоский массив строк (тот же формат, что уже строит
// HouseMappingService.generateFinalPriceList и отдаёт /api/v1/price-data).
// sectorKeys — Set строк "sheet_name|sheet_sector_name" для отбора.
function buildGroups(priceList, sectorKeys, includeDetailedAddress) {
  const groupsMap = {};
  const addressPrograms = includeDetailedAddress ? {} : null;

  priceList.forEach((item) => {
    const key = `${item.sheet_name}|${item.sheet_sector_name}`;
    if (!sectorKeys.has(key)) return;

    const city = baseCityName(item.sheet_name);
    const isBC = isBcSheetName(item.sheet_name);
    const groupKey = city + '|' + (isBC ? 'bc' : 'jk');

    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = {
        city,
        isBC,
        label: (isBC ? 'БЦ ' : 'ЖК ') + city,
        diagonal: isBC ? '21.5 дюймов (55 см) и 43 дюйма (110 см)' : '15.6 дюймов (40 см)',
        sectors: {},
      };
    }
    const sectorName = displaySectorName(item.sheet_sector_name, isBC);
    if (!groupsMap[groupKey].sectors[sectorName]) {
      groupsMap[groupKey].sectors[sectorName] = {
        name: sectorName,
        monitors: 0,
        basePrice30d: item.price || 0,
        houses: [],
      };
    }
    groupsMap[groupKey].sectors[sectorName].monitors += item.actual_monitors || 0;
    groupsMap[groupKey].sectors[sectorName].houses.push(item);

    if (includeDetailedAddress) {
      if (!addressPrograms[city]) addressPrograms[city] = { jk: [], bc: [] };
      const bucket = addressPrograms[city][isBC ? 'bc' : 'jk'];
      let sectorEntry = bucket.find((s) => s.name === sectorName);
      if (!sectorEntry) {
        sectorEntry = { name: sectorName, houses: [] };
        bucket.push(sectorEntry);
      }
      sectorEntry.houses.push(
        isBC
          ? {
              name: item.sheet_house_name,
              address: item.sheet_address,
              monitorsLift: item.monitors_lift,
              monitorsHall: item.monitors_hall,
              // Резерв на случай, когда разбивка лифт/холл не заполнена в
              // источнике — тогда хотя бы общее число мониторов не потеряется.
              monitors: item.actual_monitors,
              floors: item.floors,
              orgs: item.apartments,
            }
          : {
              name: item.sheet_house_name,
              address: item.sheet_address,
              monitors: item.actual_monitors,
              entrances: item.entrances,
              floors: item.floors,
              apartments: item.apartments,
            },
      );
    }
  });

  const cityOrder = ['Астана', 'Алматы'];
  const groups = Object.values(groupsMap)
    .map((g) => ({ ...g, sectors: Object.values(g.sectors) }))
    .sort((a, b) => {
      const ca = cityOrder.indexOf(a.city);
      const cb = cityOrder.indexOf(b.city);
      if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
      return (a.isBC ? 1 : 0) - (b.isBC ? 1 : 0);
    });

  return { groups, addressPrograms };
}

/**
 * @param {object} opts
 * @param {number[]} opts.sectorMappingIds  id-шники строк sector_mappings
 * @param {string} opts.clientName
 * @param {number} opts.days
 * @param {number} opts.discountPct
 * @param {boolean} opts.includeVat
 * @param {boolean} [opts.includeDetailedAddress]
 * @param {object[]} priceList  уже посчитанный HouseMappingService.generateFinalPriceList(sheetData)
 * @returns {Promise<{ url: string, filename: string }>}
 */
async function generateAndShareKp(opts, priceList) {
  const mappings = await localDb('sector_mappings')
    .whereIn('id', opts.sectorMappingIds)
    .select('sheet_name', 'sheet_sector_name');

  if (mappings.length === 0) {
    throw new Error('Не найдено ни одного сектора по переданным sectorMappingIds');
  }
  const sectorKeys = new Set(mappings.map((m) => `${m.sheet_name}|${m.sheet_sector_name}`));

  const { groups, addressPrograms } = buildGroups(
    priceList,
    sectorKeys,
    !!opts.includeDetailedAddress,
  );
  if (groups.length === 0) {
    throw new Error('Выбранные сектора не найдены в текущем прайс-листе (сверьте с /api/v1/price-data)');
  }

  const media = loadMediaFromDisk();

  // Ссылка на карту — не блокирующая: если создание ссылки не удалось
  // (например, ещё нет таблицы map_links на старом окружении), КП всё
  // равно должно сгенерироваться, просто без ссылки на карту.
  let mapUrl = null;
  if (opts.origin) {
    try {
      mapUrl = await createMapShareLink(opts.sectorMappingIds, opts.origin);
    } catch (e) {
      console.error('Не удалось создать ссылку на карту:', e.message);
    }
  }

  const wb = await SmetaExcel.buildSmetaWorkbook(ExcelJS, {
    clientName: opts.clientName,
    days: parseInt(opts.days, 10) || 30,
    discountPct: opts.discountPct > 0 ? opts.discountPct : 0,
    includeVat: !!opts.includeVat,
    groups,
    addressPrograms,
    media,
    mapUrl,
  });

  const buffer = await wb.xlsx.writeBuffer();

  const safeClientName = (opts.clientName || 'Client').trim().replace(/[^\p{L}\p{N}_\-]+/gu, '_');
  const filename = `Smeta_LiftMedia_${safeClientName}_${Date.now()}.xlsx`;

  const remotePath = await uploadFileToNextcloud(filename, Buffer.from(buffer));
  const url = await createPublicShareLink(remotePath);

  return { url, filename };
}

/**
 * Список секторов с id (sector_mappings.id) — для CRM-синхронизации
 * справочника услуг. Отдельно от price-data: там нет id и есть тяжёлая
 * детализация по домам, которая тут не нужна.
 */
async function listSectorsForSync() {
  const rows = await localDb('sector_mappings').select('id', 'sheet_name', 'sheet_sector_name', 'price');
  return rows.map((r) => ({
    id: r.id,
    city: baseCityName(r.sheet_name),
    is_bc: isBcSheetName(r.sheet_name),
    name: displaySectorName(r.sheet_sector_name, isBcSheetName(r.sheet_name)),
    price: r.price || 0,
  }));
}

// Ссылка на интерактивную карту (public/map.html) с выбранными
// секторами — сама карта и хранилище коротких ссылок (таблица
// map_links) уже существовали и работали для залогиненных пользователей
// браузера (кнопка "Копировать ссылку на карту" в генераторе), просто
// не были доступны серверному API-key потоку (CRM). Формат данных —
// тот же, что строит клиентский copyMapLink() в public/index.html:
// "sheet_name:sheet_sector_name" через запятую, url-encoded.
async function createMapShareLink(sectorMappingIds, origin) {
  const mappings = await localDb('sector_mappings')
    .whereIn('id', sectorMappingIds)
    .select('sheet_name', 'sheet_sector_name');

  if (mappings.length === 0) {
    throw new Error('Не найдено ни одного сектора по переданным sectorMappingIds');
  }

  const sectorsFormatted = mappings
    .map((m) => encodeURIComponent(`${m.sheet_name}:${m.sheet_sector_name}`))
    .join(',');

  const id = crypto.randomUUID().slice(0, 8);
  await localDb('map_links').insert({
    id,
    sectors_data: sectorsFormatted,
    created_at: localDb.fn.now(),
    updated_at: localDb.fn.now(),
  });

  return `${origin}/map.html?c=${id}`;
}

module.exports = {
  generateAndShareKp,
  buildGroups,
  listSectorsForSync,
  createMapShareLink,
  baseCityName,
  isBcSheetName,
  displaySectorName,
};
