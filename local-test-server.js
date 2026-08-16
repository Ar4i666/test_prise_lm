// Локальный тестовый стенд — НЕ настоящий прайс-сервис, а его "заглушка"
// с реальными данными (сектора/дома/цены из копии таблицы + выгрузки),
// но без доступа к их боевой базе устройств (мониторы — как в таблице,
// не сверены с реальными приборами). Нужен только чтобы прогнать полный
// путь CRM -> сгенерировать КП -> Nextcloud -> ссылка, пока не появится
// настоящий развёрнутый сервис у Айбека.
require("dotenv").config({ path: __dirname + "/.env" });
const path = require("path");
const express = require("express");
const app = express();
app.use(express.json({ limit: "15mb" }));
// Отдаём public/ статикой — иначе ссылка "Показать на карте" ведёт в
// "Cannot GET /map.html" (этот стенд раньше вообще не раздавал файлы).
// ВАЖНО: сама карта всё равно не отрисуется по-настоящему в этой
// песочнице — map.html тянет живые данные секторов с /api/price-data,
// которого здесь нет (нужны настоящие Google Sheets, как и везде в этой
// интеграции) — но страница хотя бы загрузится, а не 404.
app.use(express.static(path.join(__dirname, "public")));

const GenerateKpService = require("./services/GenerateKpService");
const GeneratePdfService = require("./services/GeneratePdfService");
const priceList = require("./local-price-list.json");

const API_KEY = process.env.LOCAL_TEST_API_KEY;
if (!API_KEY) {
  console.error("LOCAL_TEST_API_KEY не задан в окружении");
  process.exit(1);
}

function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (key === API_KEY) return next();
  return res.status(401).json({ success: false, message: "Unauthorized: invalid or missing API key" });
}

app.post("/api/v1/generate-kp", requireApiKey, async (req, res) => {
  try {
    const { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress } = req.body || {};
    if (!Array.isArray(sectorMappingIds) || sectorMappingIds.length === 0) {
      return res.status(400).json({ success: false, message: "sectorMappingIds обязателен и не должен быть пустым" });
    }
    if (!clientName || !String(clientName).trim()) {
      return res.status(400).json({ success: false, message: "clientName обязателен" });
    }

    const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const { url, filename } = await GenerateKpService.generateAndShareKp(
      { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress, origin },
      priceList,
    );
    res.json({ success: true, url, filename });
  } catch (error) {
    console.error("Ошибка в /api/v1/generate-kp:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/v1/generate-kp-pdf", requireApiKey, async (req, res) => {
  try {
    const { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress, managerName, managerPhoneExt } = req.body || {};
    if (!Array.isArray(sectorMappingIds) || sectorMappingIds.length === 0) {
      return res.status(400).json({ success: false, message: "sectorMappingIds обязателен и не должен быть пустым" });
    }
    if (!clientName || !String(clientName).trim()) {
      return res.status(400).json({ success: false, message: "clientName обязателен" });
    }

    const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const { url, filename } = await GeneratePdfService.generateAndSharePdfKp(
      { sectorMappingIds, clientName, days, discountPct, includeVat, includeDetailedAddress, managerName, managerPhoneExt, origin },
      priceList,
    );
    res.json({ success: true, url, filename });
  } catch (error) {
    console.error("Ошибка в /api/v1/generate-kp-pdf:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/v1/sectors", requireApiKey, async (req, res) => {
  try {
    const sectors = await GenerateKpService.listSectorsForSync();
    res.json({ success: true, sectors });
  } catch (error) {
    console.error("Ошибка в /api/v1/sectors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/v1/share-map", requireApiKey, async (req, res) => {
  try {
    const { sectorMappingIds } = req.body || {};
    if (!Array.isArray(sectorMappingIds) || sectorMappingIds.length === 0) {
      return res.status(400).json({ success: false, message: "sectorMappingIds обязателен и не должен быть пустым" });
    }
    const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const url = await GenerateKpService.createMapShareLink(sectorMappingIds, origin);
    res.json({ success: true, url });
  } catch (error) {
    console.error("Ошибка в /api/v1/share-map:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const port = process.env.LOCAL_TEST_PORT || 3100;
app.listen(port, () => console.log(`[local-test-server] слушает на порту ${port}`));
