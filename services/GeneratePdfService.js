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
//
// ВАЖНО про НДС: используем ту же (уже исправленную) формулу, что и
// smeta-excel.js — цена в прайсе уже С НДС, для "без НДС" делим на 1.16.
// НЕ прибавляем 16% сверху к базовой цене — так считает старая версия
// генератора на живом price.liftmedia.kz (у неё "Базовая стоимость"
// одинакова что с НДС, что без, а 16% просто добавляются сверху), это
// тот самый баг двойного счёта, который уже был найден и исправлен
// раньше (иначе сумма в PDF снова разойдётся с суммой в CRM/Excel).
// ─────────────────────────────────────────────────────────

const SHOWS_PER_DAY_PER_MONITOR = 288; // та же константа, что в smeta-excel.js (K10)

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function money(n) {
  return Math.round(n).toLocaleString('ru-RU') + ' ₸';
}

function num(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

function fileDataUri(filename) {
  const filePath = path.join(__dirname, '..', 'public', filename);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filename).slice(1);
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,` + fs.readFileSync(filePath).toString('base64');
}

// Считает по сектору те же метрики, что показывает Приложение №1
// живого генератора: объекты/мониторы/квартиры(-организации)/показы/сумма.
function sectorMetrics(sec, days, discount, includeVat) {
  const pricePerDay = includeVat ? sec.basePrice30d / 30 : sec.basePrice30d / 1.16 / 30;
  const pricePerDayDiscounted = pricePerDay * (1 - discount / 100);
  const sum = pricePerDayDiscounted * days;
  const shows = SHOWS_PER_DAY_PER_MONITOR * sec.monitors * days;
  const objects = sec.houses.length;
  // "apartments" — общее поле выгрузки (квартиры для ЖК, организации/офисы
  // для БЦ) — так же переиспользует его и живой генератор (тот же
  // заголовок "Квартир" для обоих типов секторов).
  const units = sec.houses.reduce((s, h) => s + (Number(h.apartments) || 0), 0);
  return { objects, monitors: sec.monitors, units, shows, sum };
}

function buildCoverPage(opts, groups, letterhead, logo) {
  const { clientName, days, discountPct, includeVat } = opts;
  const discount = discountPct > 0 ? discountPct : 0;
  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const validity = new Date();
  validity.setDate(validity.getDate() + 7);
  const validityDate = validity.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let listPriceTotal = 0;
  const cityLines = groups.map((g) => {
    const monitors = g.sectors.reduce((s, sec) => s + sec.monitors, 0);
    g.sectors.forEach((sec) => {
      const pricePerDay = includeVat ? sec.basePrice30d / 30 : sec.basePrice30d / 1.16 / 30;
      listPriceTotal += pricePerDay * days;
    });
    return `<div class="row"><span>${esc(g.label)}:</span><span>${num(monitors)} мониторов</span></div>`;
  }).join('');

  const discountAmount = listPriceTotal * (discount / 100);
  const grandTotal = listPriceTotal - discountAmount;

  return `
  <div class="cover-page" style="background-image:url('${letterhead}')">
    <h1 class="cover-title">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
    <p class="cover-intro">Благодарим вас за проявленный интерес к нашей рекламной сети. Наша компания предлагает
      размещение рекламных видеоматериалов на мониторах в лифтовых холлах и внутри лифтов в жилых комплексах
      бизнес- и премиум-класса. Ниже представлена сводная смета по выбранным секторам:</p>

    <div class="info-box">
      <div>
        <div class="label">Заказчик</div>
        <div class="value">${esc(clientName?.trim() || 'Уважаемый клиент')}</div>
      </div>
      <div class="align-right">
        <div class="label">Дата создания документа</div>
        <div class="value">${today}</div>
        <div class="label" style="margin-top:4px">Срок размещения</div>
        <div class="value">${days} дней</div>
      </div>
    </div>

    <div class="summary-box">
      <h3>СВОДНАЯ СМЕТА ПО РАЗМЕЩЕНИЮ</h3>
      <div class="summary-grid">
        <div class="summary-left">${cityLines}</div>
        <div class="summary-right">
          <div class="row"><span>Цена по прайсу${includeVat ? ', с НДС' : ', без НДС'}:</span><span>${money(listPriceTotal)}</span></div>
          ${discount > 0 ? `<div class="row discount"><span>Скидка (${discount}%):</span><span>- ${money(discountAmount)}</span></div>` : ''}
          <div class="row grand"><span>Итого к оплате:</span><span>${money(grandTotal)}</span></div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <p>С уважением, команда LiftMedia</p>
      <p class="validity">Цены действительны до ${validityDate} г.</p>
    </div>
  </div>`;
}

function buildAppendixPage(opts, groups) {
  const { days, discountPct, includeVat } = opts;
  const discount = discountPct > 0 ? discountPct : 0;

  let grand = { objects: 0, monitors: 0, units: 0, shows: 0, sum: 0 };

  const groupBlocks = groups.map((group) => {
    let subtotal = { objects: 0, monitors: 0, units: 0, shows: 0, sum: 0 };
    const rows = group.sectors.map((sec) => {
      const m = sectorMetrics(sec, days, discount, includeVat);
      subtotal.objects += m.objects;
      subtotal.monitors += m.monitors;
      subtotal.units += m.units;
      subtotal.shows += m.shows;
      subtotal.sum += m.sum;
      return `
        <tr>
          <td>${esc(sec.name)}</td>
          <td class="num">${num(m.objects)}</td>
          <td class="num">${num(m.monitors)}</td>
          <td class="num">${num(m.units)}</td>
          <td class="num">${num(m.shows)}</td>
          <td class="num">${money(m.sum)}</td>
        </tr>`;
    }).join('');

    grand.objects += subtotal.objects;
    grand.monitors += subtotal.monitors;
    grand.units += subtotal.units;
    grand.shows += subtotal.shows;
    grand.sum += subtotal.sum;

    return `
      <h3 class="group-title">${esc(group.label.toUpperCase())}</h3>
      <table>
        <thead>
          <tr><th>Сектор</th><th class="num">Объектов</th><th class="num">Мониторов</th><th class="num">Квартир</th><th class="num">Показов</th><th class="num">Сумма (${days} дн.)</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="subtotal">
            <td>Итого: ${esc(group.label)}</td>
            <td class="num">${num(subtotal.objects)}</td>
            <td class="num">${num(subtotal.monitors)}</td>
            <td class="num">${num(subtotal.units)}</td>
            <td class="num">${num(subtotal.shows)}</td>
            <td class="num">${money(subtotal.sum)}</td>
          </tr>
        </tbody>
      </table>`;
  }).join('');

  return `
  <div class="appendix-page">
    <h2 class="appendix-title">Приложение №1: сводная смета по секторам</h2>
    <p class="appendix-sub">Срок размещения: ${days} дн.${discount > 0 ? ` · Скидка: ${discount}%` : ''}${includeVat ? ' · с НДС' : ' · без НДС'}</p>
    ${groupBlocks}
    <table class="grand-total-table">
      <tbody>
        <tr class="grand-total">
          <td>ОБЩИЙ ИТОГ ПО ВСЕМ КАТЕГОРИЯМ</td>
          <td class="num">${num(grand.objects)} объектов</td>
          <td class="num">${num(grand.monitors)} мониторов</td>
          <td class="num">${num(grand.units)} квартир</td>
          <td class="num">${num(grand.shows)} показов</td>
          <td class="num">${money(grand.sum)}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// Приложение №2 — та же адресная программа по домам, что уходит на
// отдельные листы Excel (buildApJkSheet/buildApBcSheet), только в виде
// печатных HTML-таблиц. addressPrograms: { [city]: { jk: [{name, houses}],
// bc: [{name, houses}] } } — то же, что возвращает buildGroups() при
// includeDetailedAddress=true.
function buildApJkTable(city, sectors) {
  let totalHouses = 0, totalMonitors = 0, totalEntrances = 0, totalApartments = 0;
  const sectorBlocks = sectors.map((sec) => {
    const rows = sec.houses.map((h) => `
      <tr>
        <td>${esc(h.name)}</td>
        <td>${esc(h.address || '')}</td>
        <td class="num">${num(h.monitors || 0)}</td>
        <td class="num">${num(h.entrances || 0)}</td>
        <td class="num">${h.floors != null ? esc(String(h.floors)) : ''}</td>
        <td class="num">${num(h.apartments || 0)}</td>
      </tr>`).join('');
    const sMonitors = sec.houses.reduce((s, h) => s + (Number(h.monitors) || 0), 0);
    const sEntrances = sec.houses.reduce((s, h) => s + (Number(h.entrances) || 0), 0);
    const sApartments = sec.houses.reduce((s, h) => s + (Number(h.apartments) || 0), 0);
    totalHouses += sec.houses.length;
    totalMonitors += sMonitors;
    totalEntrances += sEntrances;
    totalApartments += sApartments;
    return `
      <tr class="sector-row"><td colspan="6">${esc(sec.name)}</td></tr>
      ${rows}
      <tr class="subtotal">
        <td colspan="2">Итого (${sec.houses.length} ЖК):</td>
        <td class="num">${num(sMonitors)}</td>
        <td class="num">${num(sEntrances)}</td>
        <td class="num"></td>
        <td class="num">${num(sApartments)}</td>
      </tr>`;
  }).join('');

  return `
    <h3 class="group-title">ЖК Г. ${esc(city.toUpperCase())}</h3>
    <table>
      <thead>
        <tr><th>Название ЖК</th><th>Адрес</th><th class="num">Мониторов</th><th class="num">Подъездов</th><th class="num">Этажей</th><th class="num">Квартир</th></tr>
      </thead>
      <tbody>
        ${sectorBlocks}
        <tr class="grand-row">
          <td colspan="2">Итого по всем секторам (${totalHouses} ЖК):</td>
          <td class="num">${num(totalMonitors)}</td>
          <td class="num">${num(totalEntrances)}</td>
          <td class="num"></td>
          <td class="num">${num(totalApartments)}</td>
        </tr>
      </tbody>
    </table>`;
}

function buildApBcTable(city, sectors) {
  let totalHouses = 0, totalMonitors = 0, totalOrgs = 0;
  const sectorBlocks = sectors.map((sec) => {
    const rows = sec.houses.map((h) => `
      <tr>
        <td>${esc(h.name)}</td>
        <td>${esc(h.address || '')}</td>
        <td class="num">${num(h.monitorsLift || 0)}</td>
        <td class="num">${num(h.monitorsHall || 0)}</td>
        <td class="num">${h.floors != null ? esc(String(h.floors)) : ''}</td>
        <td class="num">${num(h.orgs || 0)}</td>
      </tr>`).join('');
    const sMonitors = sec.houses.reduce((s, h) => s + (Number(h.monitorsLift) || 0) + (Number(h.monitorsHall) || 0), 0);
    const sOrgs = sec.houses.reduce((s, h) => s + (Number(h.orgs) || 0), 0);
    totalHouses += sec.houses.length;
    totalMonitors += sMonitors;
    totalOrgs += sOrgs;
    return `
      <tr class="sector-row"><td colspan="6">${esc(sec.name)}</td></tr>
      ${rows}
      <tr class="subtotal">
        <td colspan="2">Итого (${sec.houses.length} БЦ):</td>
        <td colspan="2" class="num">${num(sMonitors)}</td>
        <td class="num"></td>
        <td class="num">${num(sOrgs)}</td>
      </tr>`;
  }).join('');

  return `
    <h3 class="group-title">БЦ Г. ${esc(city.toUpperCase())}</h3>
    <table>
      <thead>
        <tr><th>Бизнес-центр</th><th>Адрес</th><th class="num">Мониторы в лифтах</th><th class="num">Мониторы в холлах</th><th class="num">Этажей</th><th class="num">Организаций</th></tr>
      </thead>
      <tbody>
        ${sectorBlocks}
        <tr class="grand-row">
          <td colspan="2">Итого по всем БЦ (${totalHouses} БЦ):</td>
          <td colspan="2" class="num">${num(totalMonitors)}</td>
          <td class="num"></td>
          <td class="num">${num(totalOrgs)}</td>
        </tr>
      </tbody>
    </table>`;
}

function buildAddressAppendixPage(addressPrograms, days) {
  if (!addressPrograms) return '';
  const cityOrder = ['Астана', 'Алматы'];
  const cities = Object.keys(addressPrograms).sort(
    (a, b) => cityOrder.indexOf(a) - cityOrder.indexOf(b),
  );
  const blocks = cities.map((city) => {
    const ap = addressPrograms[city];
    const jk = ap.jk && ap.jk.length ? buildApJkTable(city, ap.jk) : '';
    const bc = ap.bc && ap.bc.length ? buildApBcTable(city, ap.bc) : '';
    return jk + bc;
  }).join('');

  return `
  <div class="appendix-page">
    <h2 class="appendix-title">Приложение №2: подробная адресная программа</h2>
    <p class="appendix-sub">Срок размещения: ${days} дн.</p>
    ${blocks}
  </div>`;
}

function buildSmetaHtml(opts) {
  const { groups, addressPrograms, days } = opts;
  const letterhead = fileDataUri('blank_astana.jpg');
  const logo = fileDataUri('smeta-logo.png');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; }

  .cover-page {
    width: 210mm; height: 297mm; padding: 55mm 18mm 25mm 18mm;
    background-size: cover; background-position: top center; background-repeat: no-repeat;
    display: flex; flex-direction: column; page-break-after: always;
  }
  .cover-title { text-align: center; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #111827; margin-bottom: 14px; }
  .cover-intro { font-size: 10px; color: #4b5563; line-height: 1.6; margin-bottom: 14px; }
  .info-box, .summary-box { border: 2px solid #00c0a5; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; }
  .info-box { display: flex; justify-content: space-between; }
  .info-box .align-right { text-align: right; }
  .label { color: #9ca3af; text-transform: uppercase; font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; }
  .value { font-weight: 800; font-size: 12px; color: #111827; margin-top: 2px; }
  .summary-box h3 { font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: #00806e; border-bottom: 2px solid #00c0a5; padding-bottom: 6px; margin-bottom: 10px; letter-spacing: 0.03em; }
  .summary-grid { display: flex; gap: 20px; }
  .summary-left { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .summary-right { flex: 1; border-left: 1px solid #e2e8f0; padding-left: 16px; display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; justify-content: space-between; font-size: 10px; }
  .row.discount { color: #dc2626; font-weight: 700; }
  .row.grand { font-size: 12.5px; font-weight: 900; color: #005f54; border-top: 2px dashed #cbd5e1; padding-top: 6px; margin-top: 4px; text-transform: uppercase; }
  .cover-footer { margin-top: auto; text-align: center; font-size: 9.5px; color: #4b5563; }
  .cover-footer .validity { margin-top: 6px; display: inline-block; background: #fffbeb; color: #78350f; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; font-size: 8.5px; }

  .appendix-page { padding: 14mm 14mm 14mm 14mm; }
  .appendix-title { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111827; margin-bottom: 4px; }
  .appendix-sub { font-size: 9.5px; color: #6b7280; margin-bottom: 12px; }
  .group-title { font-size: 10.5px; font-weight: 800; color: #00806e; margin: 14px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #e2e8f0; padding: 4px 7px; text-align: left; font-size: 9.5px; }
  th { background: #f0fdfa; font-size: 8.5px; text-transform: uppercase; color: #374151; }
  td.num, th.num { text-align: right; }
  tr.subtotal td { background: #ecfdf5; font-weight: 700; }
  tr.subtotal tr { page-break-inside: avoid; }
  table tr { page-break-inside: avoid; }
  .grand-total-table { margin-top: 16px; }
  .grand-total-table td { background: #4C545D; color: #fff; font-weight: 900; font-size: 10px; border-color: #4C545D; }
  tr.sector-row td { background: #00c0a5; color: #fff; font-weight: 700; font-size: 9.5px; }
  tr.grand-row td { background: #4C545D; color: #fff; font-weight: 900; }
</style>
</head>
<body>
  ${buildCoverPage(opts, groups, letterhead, logo)}
  ${buildAppendixPage(opts, groups)}
  ${buildAddressAppendixPage(addressPrograms, days)}
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

  const { groups, addressPrograms } = buildGroups(priceList, sectorKeys, !!opts.includeDetailedAddress);
  if (groups.length === 0) {
    throw new Error('Выбранные сектора не найдены в текущем прайс-листе (сверьте с /api/v1/price-data)');
  }

  const html = buildSmetaHtml({
    clientName: opts.clientName,
    days: parseInt(opts.days, 10) || 30,
    discountPct: opts.discountPct > 0 ? opts.discountPct : 0,
    includeVat: !!opts.includeVat,
    groups,
    addressPrograms,
  });

  const buffer = await htmlToPdfBuffer(html);

  const safeClientName = (opts.clientName || 'Client').trim().replace(/[^\p{L}\p{N}_\-]+/gu, '_');
  const filename = `Smeta_LiftMedia_${safeClientName}_${Date.now()}.pdf`;

  const remotePath = await uploadFileToNextcloud(filename, buffer);
  const url = await createPublicShareLink(remotePath);

  return { url, filename };
}

module.exports = { generateAndSharePdfKp, buildSmetaHtml };
