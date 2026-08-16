require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3099;
const crypto = require('crypto');

const HouseMappingService = require('./services/HouseMappingService');
const GoogleSheetsService = require('./services/GoogleSheetsService');
const GenerateKpService = require('./services/GenerateKpService');
const { localDb, remoteDb } = require('./config/database');

// ─────────────────────────────────────────────────────────
// Authentication & JWT helpers (Self-contained, Native)
// ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'liftmedia-price-secret-key-2026-v1';

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, data, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  try {
    const [salt, hash] = storedPassword.split(':');
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  } catch (e) {
    return false;
  }
}

// Helper to parse cookies manually
function getCookie(req, name) {
  const headersCookie = req.headers.cookie;
  if (!headersCookie) return null;
  const parts = headersCookie.split(';');
  for (const part of parts) {
    const pair = part.trim().split('=');
    if (pair[0] === name) return pair[1];
  }
  return null;
}

// Authentication middleware
function authenticate(req, res, next) {
  // Public API key routes
  if (
    req.path === '/api/v1/price-data' ||
    req.path === '/api/v1/mapped-houses' ||
    req.path === '/api/v1/district-prices' ||
    req.path === '/api/v1/generate-kp' ||
    req.path === '/api/v1/sectors'
  ) {
    return next();
  }
  // Public tracking links
  if (req.path.startsWith('/p/')) {
    return next();
  }

  const token = getCookie(req, 'session_token');
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    req.user = payload;
  }

  // Redirect logged-in users away from login.html
  if (req.path === '/login.html' && req.user) {
    return res.redirect('/index.html');
  }

  // Public paths exempt from auth check
  const publicPaths = ['/api/login', '/login.html', '/api/config'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  
  if (req.path.startsWith('/api/share-map/') && req.method === 'GET') {
    return next();
  }

  // Check if request is for map client/shared view:
  // If GET /map.html with "?s=" parameter, allow publicly
  if (req.path === '/map.html' && (req.query.s || req.query.c)) {
    return next();
  }

  // If map API requests are made from a public shared map page, allow them:
  const referer = req.headers.referer || '';
  const isSharedMapReferer = referer.includes('map.html') && (referer.includes('?s=') || referer.includes('&s=') || referer.includes('?c=') || referer.includes('&c='));
  const allowedSharedApiPaths = ['/api/price-list', '/api/sectors', '/api/config'];
  
  if (isSharedMapReferer && allowedSharedApiPaths.includes(req.path)) {
    return next();
  }

  // Check if HTML page request (needs redirect to login)
  const isHtmlRequest = req.path === '/' || req.path.endsWith('.html') || !req.path.includes('.');
  if (isHtmlRequest && !req.user) {
    return res.redirect('/login.html');
  }

  // Check if API request (needs 401 response)
  if (req.path.startsWith('/api/') && !req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Session expired or missing' });
  }

  next();
}

// Route permissions mapping
const routePermissions = {
  // Admin and Supervisor only
  '/api/test-sheets': ['admin', 'supervisor'],
  '/api/sync-status': ['admin', 'supervisor'],
  '/api/unmapped-houses': ['admin', 'supervisor'],
  '/api/db-only-houses': ['admin', 'supervisor'],
  '/api/search-houses': ['admin', 'supervisor'],
  '/api/search-districts': ['admin', 'supervisor'],
  '/api/upload-photo': ['admin', 'supervisor'],
  '/api/search-images': ['admin', 'supervisor'],
  '/api/sector-mappings': ['admin', 'supervisor'],
  '/api/mappings': ['admin', 'supervisor'],
  '/api/test-houses': ['admin', 'supervisor'],
  
  // Admin, Supervisor, and Manager
  '/api/users': ['admin'],
  '/api/price-list': ['admin', 'supervisor', 'manager'],
  '/api/sectors': ['admin', 'supervisor', 'manager'],
  '/api/occupancy': ['admin', 'supervisor', 'manager'],
  '/api/tracking-links': ['admin', 'supervisor', 'manager'],
  '/api/upload-and-track': ['admin', 'supervisor', 'manager'],
  '/api/share-map': ['admin', 'supervisor', 'manager'],
  '/api/user-info': ['admin', 'supervisor', 'manager'],
  '/api/logout': ['admin', 'supervisor', 'manager'],
  '/api/geocode': ['admin', 'supervisor', 'manager'],
};

// Role enforcement middleware
function checkRole(req, res, next) {
  // If the request is not for an API, bypass role authorization check
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Public paths
  if (req.path === '/api/login' || req.path === '/api/config' || req.path === '/api/v1/price-data' || req.path === '/api/v1/mapped-houses' || req.path === '/api/v1/district-prices' || req.path.startsWith('/p/') || (req.path.startsWith('/api/share-map/') && req.method === 'GET')) {
    return next();
  }

  // Shared map referer
  const referer = req.headers.referer || '';
  const isSharedMapReferer = referer.includes('map.html') && (referer.includes('?s=') || referer.includes('&s=') || referer.includes('?c=') || referer.includes('&c='));
  const allowedSharedApiPaths = ['/api/price-list', '/api/sectors', '/api/config'];
  if (isSharedMapReferer && allowedSharedApiPaths.includes(req.path)) {
    return next();
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Admin has full access to all endpoints
  if (user.role === 'admin') {
    return next();
  }

  const path = req.path;
  
  // Find matching rule
  let allowedRoles = null;
  for (const [route, roles] of Object.entries(routePermissions)) {
    if (path === route || path.startsWith(route + '/')) {
      allowedRoles = roles;
      break;
    }
  }

  // If no rule is found, default to admin-only (future proofing!)
  if (!allowedRoles) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions for new features' });
  }

  if (allowedRoles.includes(user.role)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
}

// User initialization logic
async function initDefaultUsers() {
  const defaultUsers = [
    { username: 'admin', role: 'admin', defaultPass: 'admin2026', full_name: 'Администратор', phone: '200' },
    { username: 'supervisor', role: 'supervisor', defaultPass: 'supervisor2026', full_name: 'Евгений', phone: '215' },
    { username: 'manager', role: 'manager', defaultPass: 'manager2026', full_name: 'Менеджер ОП', phone: '220' }
  ];

  for (const defUser of defaultUsers) {
    const existing = await localDb('users').where('username', defUser.username).first();
    if (!existing) {
      console.log(`[Auth] Creating default user in DB: ${defUser.username}`);
      const passwordHash = hashPassword(defUser.defaultPass);
      await localDb('users').insert({
        username: defUser.username,
        role: defUser.role,
        password_hash: passwordHash,
        full_name: defUser.full_name,
        phone: defUser.phone,
        created_at: localDb.fn.now(),
        updated_at: localDb.fn.now()
      });
    } else {
      if (existing.full_name === null || existing.phone === null) {
        console.log(`[Auth] Seeding default name/phone for user: ${defUser.username}`);
        await localDb('users')
          .where('username', defUser.username)
          .update({
            full_name: existing.full_name || defUser.full_name,
            phone: existing.phone || defUser.phone,
            updated_at: localDb.fn.now()
          });
      }
    }
  }
}

app.use(express.json({ limit: '15mb' }));

// Apply authentication and checkRole middlewares
app.use(authenticate);
app.use(checkRole);

// Auth API endpoints
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Пожалуйста, введите логин и пароль' });
    }

    const user = await localDb('users').where('username', username).first();
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Неверное имя пользователя или пароль' });
    }

    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      exp
    });

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ success: true, user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Вы успешно вышли из системы' });
});

app.get('/api/user-info', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  try {
    const user = await localDb('users').where('id', req.user.userId).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

// ─────────────────────────────────────────────────────────
// API Key middleware for external services
// Usage: set header  X-Api-Key: <your key>
// or query param:    ?api_key=<your key>
// ─────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!process.env.API_KEY || key === process.env.API_KEY) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing API key' });
}

// ─────────────────────────────────────────────────────────
// PUBLIC API v1 — for external services (PDF generator etc.)
// GET /api/v1/price-data
//
// Returns the full structured price list:
// {
//   generated_at,
//   cities: [ { name, sectors: [ { name, price, houses: [...] } ] } ],
//   totals: { entrances, apartments, monitors, amount }
// }
// ─────────────────────────────────────────────────────────
app.get('/api/v1/price-data', requireApiKey, async (req, res) => {
  try {
    const sheetData = await GoogleSheetsService.getParsedAddressProgram();
    const priceList = await HouseMappingService.generateFinalPriceList(sheetData);

    if (!priceList || priceList.length === 0) {
      return res.json({ success: true, generated_at: new Date().toISOString(), cities: [], totals: {} });
    }

    // Group by city (sheet_name) -> sector (sheet_sector_name)
    const cityMap = {};
    priceList.forEach(item => {
      const city = item.sheet_name || 'Unknown';
      if (!cityMap[city]) {
        cityMap[city] = {
          name: city,
          city_id: null,
          sectors: {}
        };
      }
      if (item.city_id && !cityMap[city].city_id) {
        cityMap[city].city_id = item.city_id;
      }
      const sector = item.sheet_sector_name || 'Unknown';
      if (!cityMap[city].sectors[sector]) {
        cityMap[city].sectors[sector] = { 
          name: sector, 
          price: item.price || 0,
          is_bc: item.is_bc || false,
          houses: [] 
        };
      }
      cityMap[city].sectors[sector].houses.push({
        name: item.sheet_house_name,
        address: item.sheet_address,
        city_id: item.city_id,
        entrances: item.entrances || 0,
        floors: item.floors || '',
        apartments: item.apartments || 0,
        monitors_in_price: item.original_monitors || 0,
        monitors_actual: item.actual_monitors || 0,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        photo_url: item.photo_url || null
      });
    });

    const cities = Object.values(cityMap).map(c => ({
      name: c.name,
      city_id: c.city_id,
      sectors: Object.values(c.sectors)
    }));

    // Grand totals
    const flat = priceList;
    const totals = {
      entrances:  flat.reduce((s, h) => s + (h.entrances || 0), 0),
      apartments: flat.reduce((s, h) => s + (h.apartments || 0), 0),
      monitors:   flat.reduce((s, h) => s + (h.actual_monitors || 0), 0),
      amount:     cities.reduce((s, c) => s + c.sectors.reduce((ss, sec) => ss + (sec.price || 0), 0), 0)
    };

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      cities,
      totals
    });
  } catch (error) {
    console.error('Ошибка в /api/v1/price-data:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/v1/district-prices — цена каждого района chronos (для asterisk_cloud)
// Прайсовая цена задаётся на СЕКТОР; сектор может охватывать несколько районов —
// тогда цену делим поровну между районами. Возвращает по строке на район.
// Ответ: { success, prices: [{ district_id, price, sector, city }] }
// ─────────────────────────────────────────────────────────
app.get('/api/v1/district-prices', requireApiKey, async (req, res) => {
  try {
    const mappings = await localDb('sector_mappings').select('*');
    const prices = [];
    for (const m of mappings) {
      let ids = [];
      try { ids = JSON.parse(m.db_district_ids || '[]'); } catch (e) { ids = []; }
      ids = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length === 0) continue;
      const perDistrict = Math.round((Number(m.price) || 0) / ids.length);
      const city = String(m.sheet_name || '').replace(/^BC\s+/i, '').trim();
      for (const id of ids) {
        prices.push({ district_id: id, price: perDistrict, sector: m.sheet_sector_name || '', city });
      }
    }
    res.json({ success: true, generated_at: new Date().toISOString(), prices });
  } catch (error) {
    console.error('Ошибка в /api/v1/district-prices:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/v1/mapped-houses — список замапленных домов (для сервиса проверки экранов)
// Возвращает: { success, houses: [{ sheet_house_name, sheet_city_name, db_house_ids }] }
// ─────────────────────────────────────────────────────────
app.get('/api/v1/mapped-houses', requireApiKey, async (req, res) => {
  try {
    const houses = await HouseMappingService.getMappedHousesForExport();
    res.json({ success: true, houses });
  } catch (error) {
    console.error('Ошибка в /api/v1/mapped-houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/v1/generate-kp — собирает смету (Excel) по выбранным секторам,
// заливает в Nextcloud и возвращает публичную ссылку. Для внешних
// потребителей (CRM), см. GenerateKpService.js.
//
// Тело запроса: {
//   sectorMappingIds: number[],   // id строк sector_mappings
//   clientName: string,
//   days: number,
//   discountPct?: number,
//   includeVat?: boolean,
//   includeDetailedAddress?: boolean
// }
// Ответ: { success, url, filename }
// ─────────────────────────────────────────────────────────
app.post('/api/v1/generate-kp', requireApiKey, async (req, res) => {
  try {
    const { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress } = req.body || {};

    if (!Array.isArray(sectorMappingIds) || sectorMappingIds.length === 0) {
      return res.status(400).json({ success: false, message: 'sectorMappingIds обязателен и не должен быть пустым' });
    }
    if (!clientName || !String(clientName).trim()) {
      return res.status(400).json({ success: false, message: 'clientName обязателен' });
    }

    const sheetData = await GoogleSheetsService.getParsedAddressProgram();
    const priceList = await HouseMappingService.generateFinalPriceList(sheetData);

    const { url, filename } = await GenerateKpService.generateAndShareKp(
      { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress },
      priceList,
    );

    res.json({ success: true, url, filename });
  } catch (error) {
    console.error('Ошибка в /api/v1/generate-kp:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/v1/sectors — плоский список секторов с id, ценой и
// человекочитаемым названием — для внешней синхронизации справочника
// (CRM). Отдельно от price-data: там нет id секторов и есть ненужная
// для синхронизации детализация по домам.
// Ответ: { success, sectors: [{ id, city, is_bc, name, price }] }
// ─────────────────────────────────────────────────────────
app.get('/api/v1/sectors', requireApiKey, async (req, res) => {
  try {
    const sectors = await GenerateKpService.listSectorsForSync();
    res.json({ success: true, sectors });
  } catch (error) {
    console.error('Ошибка в /api/v1/sectors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/test-sheets', async (req, res) => {
  try {
    const sheets = await GoogleSheetsService.getSpreadsheetInfo();
    // Попробуем прочитать первые несколько строк первого листа
    const firstSheetName = sheets[0];
    const data = await GoogleSheetsService.getSheetData(`${firstSheetName}!A1:E5`);
    
    res.json({ 
      success: true, 
      spreadsheetId: process.env.SPREADSHEET_ID,
      availableSheets: sheets,
      sampleData: data 
    });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/test-sheets:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при работе с Google Sheets', 
      error: error.message 
    });
  }
});

app.get('/api/sync-status', async (req, res) => {
  try {
    // 1. Получаем "чистые" данные из гугл таблицы (теперь со всех листов)
    const sheetData = await GoogleSheetsService.getParsedAddressProgram();
    
    // 2. Сопоставляем их с нашей базой маппингов
    const syncStatus = await HouseMappingService.getSyncStatus(sheetData);
    
    res.json({
      success: true,
      count: syncStatus.length,
      unmapped_count: syncStatus.filter(i => !i.is_mapped).length,
      data: syncStatus
    });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/sync-status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.get('/api/price-list', async (req, res) => {
  try {
    const sheetData = await GoogleSheetsService.getParsedAddressProgram();
    const priceList = await HouseMappingService.generateFinalPriceList(sheetData);
    
    res.json({ success: true, count: priceList.length, data: priceList });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/price-list:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Вспомогательные функции для ограничения геокодирования городами присутствия мониторов
function getBaseCityName(sheetCityName) {
  const name = sheetCityName.toLowerCase();
  if (name.includes('almaty') || name.includes('алматы')) return 'алматы';
  if (name.includes('astana') || name.includes('астана')) return 'астана';
  if (name.includes('шымкент') || name.includes('shymkent')) return 'шымкент';
  if (name.includes('караганда') || name.includes('karaganda')) return 'караганда';
  return name.replace(/\b(bc|бц)\b/g, '').trim();
}

function isResultInAllowedCities(geoObject, allowedCities) {
  const addressMetaData = geoObject?.metaDataProperty?.GeocoderMetaData?.Address;
  const countryCode = addressMetaData?.country_code;
  
  if (countryCode && countryCode !== 'KZ') {
    return false;
  }
  
  const formattedAddress = (geoObject?.metaDataProperty?.GeocoderMetaData?.text || '').toLowerCase();
  if (!countryCode && !formattedAddress.includes('казахстан') && !formattedAddress.includes('kazakhstan')) {
    return false;
  }
  
  const components = addressMetaData?.Components || [];
  const hasCityMatch = components.some(comp => {
    const kind = comp.kind;
    const name = (comp.name || '').toLowerCase();
    if (['locality', 'province', 'area', 'district'].includes(kind)) {
      return allowedCities.some(allowedCity => name.includes(allowedCity));
    }
    return false;
  });
  
  if (hasCityMatch) return true;
  return allowedCities.some(allowedCity => formattedAddress.includes(allowedCity));
}

app.get('/api/geocode', async (req, res) => {
  try {
    const { address, city } = req.query;
    if (!address) {
      return res.status(400).json({ success: false, message: 'Address query parameter is required' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) {
      return res.json({ 
        success: false, 
        message: 'Yandex API Key is not set in backend .env' 
      });
    }

    // Динамически получаем список городов из базы
    let allowedCities = ['алматы', 'almaty', 'астана', 'astana'];
    try {
      const rows = await localDb('house_mappings').distinct('sheet_city_name');
      const citiesSet = new Set();
      rows.forEach(r => {
        if (r.sheet_city_name) {
          const base = getBaseCityName(r.sheet_city_name);
          if (base) {
            citiesSet.add(base);
            if (base === 'алматы') {
              citiesSet.add('almaty');
            } else if (base === 'астана') {
              citiesSet.add('astana');
              citiesSet.add('нур-султан');
              citiesSet.add('nursultan');
            }
          }
        }
      });
      if (citiesSet.size > 0) {
        allowedCities = Array.from(citiesSet);
      }
    } catch (err) {
      console.error('Error fetching allowed cities:', err);
    }

    let fullQuery = city ? `${city}, ${address}` : address;
    // Force the search to be within Kazakhstan to avoid finding addresses in Russia/Moscow
    if (!fullQuery.toLowerCase().includes('казахстан') && !fullQuery.toLowerCase().includes('kazakhstan')) {
      fullQuery += ', Казахстан';
    }
    
    // Запрашиваем больше результатов для возможности фильтрации
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(apiKey)}&geocode=${encodeURIComponent(fullQuery)}&format=json&results=20`;

    const response = await fetch(url, {
      headers: {
        'Referer': 'https://yandex.ru'
      }
    });
    if (!response.ok) {
      throw new Error(`Yandex Geocoder returned status ${response.status}`);
    }

    const data = await response.json();
    const featureMember = data?.response?.GeoObjectCollection?.featureMember || [];
    
    if (featureMember.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No results found for the given address' 
      });
    }

    // Ищем первый результат, который находится в разрешенных городах
    let selectedGeoObject = null;
    for (const item of featureMember) {
      const geoObj = item.GeoObject;
      if (isResultInAllowedCities(geoObj, allowedCities)) {
        selectedGeoObject = geoObj;
        break;
      }
    }

    if (!selectedGeoObject) {
      return res.json({
        success: false,
        message: 'Адрес находится вне обслуживаемых городов (разрешены только Алматы и Астана)'
      });
    }

    const pos = selectedGeoObject?.Point?.pos; // Format: "long lat"
    const formattedAddress = selectedGeoObject?.metaDataProperty?.GeocoderMetaData?.text || address;

    if (!pos) {
      return res.json({ 
        success: false, 
        message: 'Coordinates not found in geocoder response' 
      });
    }

    const [lonStr, latStr] = pos.split(' ');
    const longitude = parseFloat(lonStr);
    const latitude = parseFloat(latStr);

    res.json({
      success: true,
      latitude,
      longitude,
      formatted_address: formattedAddress
    });
  } catch (error) {
    console.error('Error in /api/geocode:', error);
    res.status(500).json({ success: false, message: 'Geocoding failed', error: error.message });
  }
});

app.get('/api/search-images', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    // Step 1: Fetch vqd token from DuckDuckGo
    const initUrl = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
    const initRes = await fetch(initUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!initRes.ok) {
      throw new Error(`DuckDuckGo init request returned status ${initRes.status}`);
    }
    const html = await initRes.text();
    const vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
    if (!vqdMatch) {
      return res.json({ success: true, data: [] });
    }
    const vqd = vqdMatch[1];

    // Step 2: Fetch images
    const searchUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://duckduckgo.com/'
      }
    });
    if (!searchRes.ok) {
      throw new Error(`DuckDuckGo images request returned status ${searchRes.status}`);
    }
    const data = await searchRes.json();
    const results = data.results || [];
    
    // Return first 12 results
    const responseData = results.slice(0, 12).map(r => ({
      title: r.title,
      image: r.image,
      thumbnail: r.thumbnail
    }));

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Error in /api/search-images:', error);
    res.status(500).json({ success: false, message: 'Image search failed', error: error.message });
  }
});

const fs = require('fs');
const path = require('path');

// API для загрузки фотографии здания локально на сервер
app.post('/api/upload-photo', (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image || !filename) {
      return res.status(400).json({ success: false, message: 'Отсутствует изображение или имя файла' });
    }

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Извлекаем расширение и генерируем уникальное имя файла
    const ext = path.extname(filename) || '.jpg';
    const baseName = path.basename(filename, ext)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const uniqueFilename = `${baseName}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Записываем файл из base64 буфера
    fs.writeFileSync(filePath, Buffer.from(image, 'base64'));

    res.json({
      success: true,
      url: `/uploads/${uniqueFilename}`
    });
  } catch (error) {
    console.error('Ошибка загрузки фотографии:', error);
    res.status(500).json({ success: false, message: 'Ошибка сохранения файла на сервере', error: error.message });
  }
});



app.get('/api/search-houses', async (req, res) => {
  try {
    const query = req.query.q;
    const houses = await HouseMappingService.searchHouses(query);
    res.json({ success: true, data: houses });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/search-houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// API для получения уникальных секторов из таблицы
app.get('/api/sectors', async (req, res) => {
  try {
    const sheetData = await GoogleSheetsService.getParsedAddressProgram();
    
    // Собираем уникальные пары (Город - Сектор)
    const sectorsSet = new Set();
    const sectors = [];
    
    sheetData.forEach(i => {
      const s = i.sheet_sector_name;
      const city = i.sheet_name;
      if (s && s.trim() !== '') {
        const key = `${city}|${s}`;
        if (!sectorsSet.has(key)) {
          sectorsSet.add(key);
          sectors.push({ sheet_name: city, sheet_sector_name: s });
        }
      }
    });
    
    // Подтягиваем уже сохраненные маппинги секторов
    const mappings = await localDb('sector_mappings').select('*');
    const mappingDict = {};
    mappings.forEach(m => mappingDict[`${m.sheet_name}|${m.sheet_sector_name}`] = m);

    const result = sectors.map(sector => {
      const key = `${sector.sheet_name}|${sector.sheet_sector_name}`;
      const mapping = mappingDict[key];
      return {
        ...sector,
        is_mapped: !!mapping,
        db_district_ids: mapping ? JSON.parse(mapping.db_district_ids) : [],
        db_district_titles: mapping && mapping.db_district_titles ? JSON.parse(mapping.db_district_titles) : [],
        price: mapping ? mapping.price : 0,
        mapping_id: mapping ? mapping.id : null
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Ошибка в /api/sectors:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// API для поиска районов в базе
app.get('/api/search-districts', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json({ success: true, data: [] });

    const districts = await remoteDb('districts')
      .whereNull('deleted_at')
      .where('title', 'like', `%${query}%`)
      .select('id', 'title')
      .limit(20);

    res.json({ success: true, data: districts });
  } catch (error) {
    console.error('Ошибка в /api/search-districts:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// API для сохранения маппинга сектора
app.post('/api/sector-mappings', async (req, res) => {
  try {
    const { sheet_name, sheet_sector_name, db_district_ids, db_district_titles, price } = req.body;
    
    const existing = await localDb('sector_mappings')
      .where('sheet_name', sheet_name)
      .where('sheet_sector_name', sheet_sector_name)
      .first();
      
    const payload = { 
      sheet_name, 
      sheet_sector_name, 
      db_district_ids: JSON.stringify(db_district_ids || []), 
      db_district_titles: JSON.stringify(db_district_titles || []), 
      price: parseInt(price) || 0,
      updated_at: localDb.fn.now() 
    };

    if (existing) {
      await localDb('sector_mappings').where('id', existing.id).update(payload);
      res.json({ success: true, data: { id: existing.id } });
    } else {
      const [id] = await localDb('sector_mappings').insert({ ...payload, created_at: localDb.fn.now() });
      res.json({ success: true, data: { id } });
    }
  } catch (error) {
    console.error('Ошибка в POST /api/sector-mappings:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.delete('/api/sector-mappings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await localDb('sector_mappings').where('id', id).del();
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления sector mapping:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/mappings', async (req, res) => {
  try {
    const result = await HouseMappingService.saveMapping(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/mappings:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.delete('/api/mappings/:id', async (req, res) => {
  try {
    await HouseMappingService.deleteMapping(req.params.id);
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (error) {
    console.error('Ошибка в эндпоинте /api/mappings DELETE:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.get('/api/unmapped-houses', async (req, res) => {
  try {
    const unmapped = await HouseMappingService.getUnmappedHouses();
    res.json({ success: true, count: unmapped.length, data: unmapped });
  } catch (error) {
    console.error('Error fetching unmapped houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Дома из базы, которые НЕ привязаны ни к одному маппингу прайса + тестовые дома (всегда)
app.get('/api/db-only-houses', async (req, res) => {
  try {
    // Собираем все db_house_ids из house_mappings (не ignored)
    const mappings = await localDb('house_mappings').whereNot('is_ignored', true).select('db_house_ids');
    const mappedIds = new Set();
    mappings.forEach(m => {
      try { (JSON.parse(m.db_house_ids) || []).forEach(id => mappedIds.add(Number(id))); } catch(e){}
    });

    // Тестовые дома
    const testHouseRows = await localDb('test_houses').select('db_house_id');
    const testHouseIds = new Set(testHouseRows.map(t => Number(t.db_house_id)));

    // 1. Дома без маппинга (за исключением тестовых - их добавим отдельно ниже)
    let unmappedQuery = remoteDb('houses as h')
      .leftJoin('districts as d', 'h.district_id', 'd.id')
      .whereNull('h.deleted_at')
      .select('h.id', 'h.title', 'd.title as district', 'h.total_entrances');

    // Исключаем привязанные дома (кроме тех, что тестовые - их покажем отдельно)
    const mappedNonTestIds = Array.from(mappedIds).filter(id => !testHouseIds.has(id));
    if (mappedNonTestIds.length > 0) {
      unmappedQuery = unmappedQuery.whereNotIn('h.id', mappedNonTestIds);
    }

    const unmappedHouses = await unmappedQuery.orderBy('d.title').orderBy('h.title');

    // 2. Тестовые дома, которых нет в unmapped (они уже привязаны)
    const unmappedIds = new Set(unmappedHouses.map(h => Number(h.id)));
    const alreadyMappedTestIds = Array.from(testHouseIds).filter(id => !unmappedIds.has(id));

    let extraTestHouses = [];
    if (alreadyMappedTestIds.length > 0) {
      extraTestHouses = await remoteDb('houses as h')
        .leftJoin('districts as d', 'h.district_id', 'd.id')
        .whereNull('h.deleted_at')
        .whereIn('h.id', alreadyMappedTestIds)
        .select('h.id', 'h.title', 'd.title as district', 'h.total_entrances');
    }

    // Объединяем и проставляем is_test
    const allHouses = [...unmappedHouses, ...extraTestHouses];
    const result = allHouses.map(h => ({
      ...h,
      is_test: testHouseIds.has(Number(h.id))
    }));

    // Сортировка: тестовые сначала, затем по городу/району/названию
    result.sort((a, b) => {
      if (a.is_test !== b.is_test) return a.is_test ? -1 : 1;
      return (a.city || '').localeCompare(b.city || '') || (a.district || '').localeCompare(b.district || '') || (a.title || '').localeCompare(b.title || '');
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('Ошибка в /api/db-only-houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Пометить дом как тестовый
app.post('/api/test-houses', async (req, res) => {
  try {
    const { db_house_id, db_house_title } = req.body;
    const existing = await localDb('test_houses').where('db_house_id', db_house_id).first();
    if (!existing) {
      await localDb('test_houses').insert({ db_house_id, db_house_title, created_at: localDb.fn.now(), updated_at: localDb.fn.now() });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка в POST /api/test-houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Снять метку тестового дома
app.delete('/api/test-houses/:id', async (req, res) => {
  try {
    await localDb('test_houses').where('db_house_id', req.params.id).del();
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка в DELETE /api/test-houses:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// API для получения занятости домов по датам
app.get('/api/occupancy', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Параметры start_date и end_date обязательны' });
    }
    const occupancy = await HouseMappingService.getOccupancy(start_date, end_date);
    res.json({ success: true, occupancy });
  } catch (error) {
    console.error('Ошибка в /api/occupancy:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Получить конфигурацию для фронтенда (например, ключи API)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    twogis_api_key: process.env.TWOGIS_API_KEY || null
  });
});



// API для создания трекинг-ссылки
app.post('/api/tracking-links', async (req, res) => {
  try {
    const { nextcloud_url, client_id } = req.body;
    if (!nextcloud_url) {
      return res.status(400).json({ success: false, message: 'nextcloud_url is required' });
    }

    const id = crypto.randomUUID().substring(0, 8); // Короткий ID для ссылки
    
    await localDb('tracking_links').insert({
      id,
      nextcloud_url,
      client_id: client_id || null,
      created_at: localDb.fn.now(),
      updated_at: localDb.fn.now()
    });

    const trackingDomain = process.env.TRACKING_DOMAIN || 'https://price.liftmedia.kz';
    const trackingUrl = `${trackingDomain}/p/${id}`;

    res.json({ success: true, tracking_url: trackingUrl, id });
  } catch (error) {
    console.error('Ошибка в POST /api/tracking-links:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// API для загрузки сгенерированного PDF, сохранения в Nextcloud и выдачи трекинг-ссылки
app.post('/api/upload-and-track', async (req, res) => {
  try {
    const { filename, fileBase64, client_id } = req.body;
    if (!filename || !fileBase64) {
      return res.status(400).json({ success: false, message: 'filename and fileBase64 are required' });
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    // 1. Загружаем файл в Nextcloud
    const { uploadFileToNextcloud, createPublicShareLink } = require('./services/nextcloud');
    const remotePath = await uploadFileToNextcloud(filename, fileBuffer);

    // 2. Создаем публичную ссылку
    const nextcloudUrl = await createPublicShareLink(remotePath);

    // 3. Генерируем короткий ID
    const id = crypto.randomUUID().substring(0, 8);
    
    // 4. Сохраняем в БД
    await localDb('tracking_links').insert({
      id,
      nextcloud_url: nextcloudUrl,
      client_id: client_id || null,
      created_at: localDb.fn.now(),
      updated_at: localDb.fn.now()
    });

    const trackingDomain = process.env.TRACKING_DOMAIN || 'https://price.liftmedia.kz';
    const trackingUrl = `${trackingDomain}/p/${id}`;

    res.json({ success: true, tracking_url: trackingUrl, id });
  } catch (error) {
    console.error('Ошибка в POST /api/upload-and-track:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Роут для редиректа и трекинга открытия
app.get('/p/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const link = await localDb('tracking_links').where('id', id).first();
    
    if (!link) {
      return res.status(404).send('Ссылка не найдена');
    }

    // Если еще не открывалась, фиксируем время первого открытия
    if (!link.opened_at) {
      await localDb('tracking_links')
        .where('id', id)
        .update({ 
          opened_at: localDb.fn.now(),
          updated_at: localDb.fn.now()
        });
      
      console.log(`[Tracking] Ссылка ${id} открыта впервые. Перенаправление на ${link.nextcloud_url}`);
    }

    // Редирект на оригинальную ссылку
    res.redirect(302, link.nextcloud_url);
  } catch (error) {
    console.error(`Ошибка при переходе по ссылке /p/${req.params.id}:`, error);
    res.status(500).send('Внутренняя ошибка сервера');
  }
});

// API для шаринга карты
app.post('/api/share-map', async (req, res) => {
  try {
    const { sectors } = req.body;
    if (!sectors) {
      return res.status(400).json({ success: false, message: 'sectors are required' });
    }

    const id = crypto.randomUUID().substring(0, 8);
    
    await localDb('map_links').insert({
      id,
      sectors_data: sectors,
      created_at: localDb.fn.now(),
      updated_at: localDb.fn.now()
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error('Ошибка в POST /api/share-map:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.get('/api/share-map/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const link = await localDb('map_links').where('id', id).first();
    
    if (!link) {
      return res.status(404).json({ success: false, message: 'Ссылка не найдена' });
    }

    res.json({ success: true, sectors: link.sectors_data });
  } catch (error) {
    console.error('Ошибка в GET /api/share-map/:id:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// USER MANAGEMENT API (Admin Only)
// ─────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const list = await localDb('users')
      .select('id', 'username', 'role', 'full_name', 'phone', 'created_at', 'updated_at')
      .orderBy('username', 'asc');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера', error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, full_name, phone } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Пожалуйста, заполните все обязательные поля' });
    }

    const normUsername = username.trim().toLowerCase();
    const existing = await localDb('users').where('username', normUsername).first();
    if (existing) {
      return res.status(400).json({ success: false, message: 'Пользователь с таким логином уже существует' });
    }

    const allowedRoles = ['admin', 'supervisor', 'manager'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Недопустимая роль пользователя' });
    }

    const passwordHash = hashPassword(password);
    const [newId] = await localDb('users').insert({
      username: username.trim(),
      role,
      password_hash: passwordHash,
      full_name: full_name ? full_name.trim() : null,
      phone: phone ? phone.trim() : null,
      created_at: localDb.fn.now(),
      updated_at: localDb.fn.now()
    });

    res.json({
      success: true,
      message: 'Пользователь успешно создан',
      data: {
        id: newId,
        username: username.trim(),
        role,
        full_name: full_name ? full_name.trim() : null,
        phone: phone ? phone.trim() : null
      }
    });
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера', error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, full_name, phone } = req.body;

    if (!username || !role) {
      return res.status(400).json({ success: false, message: 'Логин и роль обязательны' });
    }

    const user = await localDb('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    const normUsername = username.trim().toLowerCase();
    const existing = await localDb('users')
      .where('username', normUsername)
      .whereNot('id', id)
      .first();
    if (existing) {
      return res.status(400).json({ success: false, message: 'Пользователь с таким логином уже существует' });
    }

    const allowedRoles = ['admin', 'supervisor', 'manager'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Недопустимая роль пользователя' });
    }

    const updatePayload = {
      username: username.trim(),
      role,
      full_name: full_name ? full_name.trim() : null,
      phone: phone ? phone.trim() : null,
      updated_at: localDb.fn.now()
    };

    if (password && password.trim() !== '') {
      updatePayload.password_hash = hashPassword(password);
    }

    await localDb('users').where('id', id).update(updatePayload);

    res.json({ success: true, message: 'Данные пользователя успешно обновлены' });
  } catch (error) {
    console.error('Error in PUT /api/users/:id:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера', error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && Number(req.user.userId) === Number(id)) {
      return res.status(400).json({ success: false, message: 'Вы не можете удалить свою собственную учетную запись' });
    }

    const userToDelete = await localDb('users').where('id', id).first();
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    if (userToDelete.role === 'admin') {
      const adminCount = await localDb('users').where('role', 'admin').count('id as cnt').first();
      if (Number(adminCount.cnt) <= 1) {
        return res.status(400).json({ success: false, message: 'Невозможно удалить последнего администратора' });
      }
    }

    await localDb('users').where('id', id).delete();

    res.json({ success: true, message: 'Пользователь успешно удален' });
  } catch (error) {
    console.error('Error in DELETE /api/users/:id:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера', error: error.message });
  }
});

localDb.migrate.latest()
  .then(() => {
    console.log('Database migrations successfully applied.');
    return initDefaultUsers();
  })
  .then(() => {
    console.log('Default users successfully initialized.');
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Critical database initialization error:', err);
    process.exit(1);
  });
