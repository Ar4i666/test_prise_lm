const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { buildGroups } = require('./GenerateKpService');
const { localDb } = require('../config/database');
const { uploadFileToNextcloud, createPublicShareLink } = require('./nextcloud');

// ─────────────────────────────────────────────────────────
// Серверная генерация PDF-сметы. Сознательно НЕ переиспользует
// Alpine-шаблон из public/index.html (downloadSmetaPdf) — тот целиком
// живёт в реактивном состоянии залогиненной страницы (нужны live-сектора
// из Google Sheets, аутентификация, и синхронизация с рендером Alpine),
// и гонять headless-браузер по всей этой цепочке ради каждого КП —
// хрупко и трудно тестируемо. Вместо этого строим отдельный печатный
// HTML из тех же сгруппированных данных (buildGroups), что и Excel —
// так суммы в PDF и Excel гарантированно совпадают, а сам рендер не
// зависит от состояния сайта.
// ─────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function money(n) {
  return Math.round(n).toLocaleString('ru-RU') + ' ₸';
}

function logoDataUri() {
  const logoPath = path.join(__dirname, '..', 'public', 'smeta-logo.png');
  if (!fs.existsSync(logoPath)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
}

function buildSmetaHtml(opts) {
  const { clientName, days, discountPct, includeVat, groups } = opts;
  const discount = discountPct > 0 ? discountPct : 0;
  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const logo = logoDataUri();

  let subtotal = 0;
  const groupBlocks = groups.map((group) => {
    const rows = group.sectors.map((sec) => {
      const pricePerDay = includeVat ? sec.basePrice30d / 30 : sec.basePrice30d / 1.16 / 30;
      const pricePerDayDiscounted = pricePerDay * (1 - discount / 100);
      const rowTotal = pricePerDayDiscounted * days;
      subtotal += rowTotal;
      return `
        <tr>
          <td>${esc(sec.name)}</td>
          <td class="num">${sec.monitors}</td>
          <td class="num">${money(pricePerDay)}</td>
          <td class="num">${money(rowTotal)}</td>
        </tr>`;
    }).join('');
    return `
      <h3 class="group-title">${esc(group.label)}</h3>
      <table>
        <thead><tr><th>Сектор</th><th class="num">Мониторов</th><th class="num">Цена/день</th><th class="num">Итого</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }).join('');

  const grandTotal = subtotal;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00c0a5; padding-bottom: 10px; margin-bottom: 16px; }
  .header img { height: 32px; }
  .header h1 { font-size: 15px; letter-spacing: 0.05em; color: #111827; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border: 2px solid #00c0a5; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 10px; }
  .meta .label { color: #6b7280; text-transform: uppercase; font-size: 8.5px; font-weight: 700; }
  .meta .value { font-weight: 800; font-size: 12px; color: #111827; }
  .group-title { font-size: 11px; font-weight: 800; color: #00806e; margin: 14px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }
  th { background: #f0fdfa; font-size: 9.5px; text-transform: uppercase; color: #374151; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 18px; border-top: 2px solid #00c0a5; padding-top: 10px; }
  .totals .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .totals .row.discount { color: #dc2626; font-weight: 700; }
  .totals .row.grand { font-size: 14px; font-weight: 900; color: #005f54; border-top: 1px dashed #cbd5e1; margin-top: 6px; padding-top: 8px; text-transform: uppercase; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #6b7280; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logo ? `<img src="${logo}">` : '<div></div>'}
    <h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
  </div>
  <div class="meta">
    <div><div class="label">Заказчик</div><div class="value">${esc(clientName)}</div></div>
    <div><div class="label">Дата</div><div class="value">${today}</div></div>
    <div><div class="label">Срок размещения</div><div class="value">${days} дней</div></div>
    <div><div class="label">НДС</div><div class="value">${includeVat ? 'с НДС (16%)' : 'без НДС'}</div></div>
  </div>
  ${groupBlocks}
  <div class="totals">
    ${discount > 0 ? `<div class="row discount"><span>Скидка</span><span>${discount}%</span></div>` : ''}
    <div class="row grand"><span>Итого к оплате</span><span>${money(grandTotal)}</span></div>
  </div>
  <div class="footer">LiftMedia — реклама на мониторах в лифтовых холлах и лифтах. Цены действительны 7 дней с даты формирования.</div>
</body>
</html>`;
}

async function htmlToPdfBuffer(html) {
  const executablePath = process.env.CHROME_EXECUTABLE_PATH
    || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * @param {object} opts  те же поля, что и generateAndShareKp
 * @param {object[]} priceList
 * @returns {Promise<{ url: string, filename: string }>}
 */
async function generateAndSharePdfKp(opts, priceList) {
  const mappings = await localDb('sector_mappings')
    .whereIn('id', opts.sectorMappingIds)
    .select('sheet_name', 'sheet_sector_name');

  if (mappings.length === 0) {
    throw new Error('Не найдено ни одного сектора по переданным sectorMappingIds');
  }
  const sectorKeys = new Set(mappings.map((m) => `${m.sheet_name}|${m.sheet_sector_name}`));

  const { groups } = buildGroups(priceList, sectorKeys, false);
  if (groups.length === 0) {
    throw new Error('Выбранные сектора не найдены в текущем прайс-листе (сверьте с /api/v1/price-data)');
  }

  const html = buildSmetaHtml({
    clientName: opts.clientName,
    days: parseInt(opts.days, 10) || 30,
    discountPct: opts.discountPct > 0 ? opts.discountPct : 0,
    includeVat: !!opts.includeVat,
    groups,
  });

  const buffer = await htmlToPdfBuffer(html);

  const safeClientName = (opts.clientName || 'Client').trim().replace(/[^\p{L}\p{N}_\-]+/gu, '_');
  const filename = `Smeta_LiftMedia_${safeClientName}_${Date.now()}.pdf`;

  const remotePath = await uploadFileToNextcloud(filename, buffer);
  const url = await createPublicShareLink(remotePath);

  return { url, filename };
}

module.exports = { generateAndSharePdfKp, buildSmetaHtml };
