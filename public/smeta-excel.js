// ============================================================
// LiftMedia — построитель сметы Excel в формате шаблона Google Sheets.
// Работает и в Node (тесты), и в браузере (index.html).
// ============================================================
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.SmetaExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {

    const GREEN = 'FF05C896';
    const DARK = 'FF4C545D';
    const HAIR = { style: 'hair' };
    const BORDER_ALL = { top: HAIR, left: HAIR, bottom: HAIR, right: HAIR };
    const FMT_ACC = '_-* #,##0_-;\\-* #,##0_-;_-* "-"??_-;_-@_-';

    const FONT_HDR = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    const FONT_HDR10 = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const FONT_TXT = { name: 'Arial', size: 9, color: { argb: 'FF000000' } };
    const FONT_TXT_B = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const CENTER = { horizontal: 'center', vertical: 'middle' };
    const CENTER_WRAP = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const FILL_GREEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    const FILL_DARK = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };

    function set(ws, addr, value, style) {
        const cell = ws.getCell(addr);
        if (value !== null && value !== undefined) cell.value = value;
        if (style) {
            if (style.font) cell.font = style.font;
            if (style.fill) cell.fill = style.fill;
            if (style.border) cell.border = style.border;
            if (style.alignment) cell.alignment = style.alignment;
            if (style.numFmt) cell.numFmt = style.numFmt;
        }
        return cell;
    }

    // Стили ячеек таблицы основного листа
    const S_TABLE_HDR = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER_WRAP };
    const S_DATA = { font: FONT_TXT, border: BORDER_ALL, alignment: CENTER, numFmt: FMT_ACC };
    const S_DATA_TXT = { font: FONT_TXT, border: BORDER_ALL, alignment: CENTER_WRAP };
    const S_DATA_PCT = { font: FONT_TXT, border: BORDER_ALL, alignment: CENTER, numFmt: '0%' };
    const S_SUBTOTAL = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER, numFmt: FMT_ACC };
    const S_SUBTOTAL_LBL = { font: FONT_HDR10, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER };
    const S_TOTAL = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: CENTER, numFmt: FMT_ACC };

    function fx(formula, result) { return { formula: formula, result: result }; }

    // ------------------------------------------------------------
    // Загрузка картинок (логотип + фото мониторов) со статики сервера.
    // Файлы извлечены из шаблона Google Sheets один раз и лежат в /public.
    // ------------------------------------------------------------
    async function fetchSmetaMedia() {
        const urls = {
            logo: '/smeta-logo.png',
            img156: '/smeta-monitor-156.png',
            img215: '/smeta-monitor-215.png',
            img43: '/smeta-monitor-43.png'
        };
        const media = {};
        await Promise.all(Object.keys(urls).map(async key => {
            const resp = await fetch(urls[key]);
            if (!resp.ok) throw new Error('Не удалось загрузить ' + urls[key]);
            media[key] = { buffer: await resp.arrayBuffer(), extension: 'png' };
        }));
        return media;
    }

    // ------------------------------------------------------------
    // Основной лист «INDOOR_led лифт»
    // groups: [{ city, isBC, label, diagonal, sectors: [{name, monitors, basePrice30d}] }]
    // ------------------------------------------------------------
    function buildMainSheet(wb, opts, media) {
        const { clientName, days, discountPct, includeVat, groups } = opts;
        const vatLabel = includeVat ? 'тг, с НДС' : 'тг, без НДС';
        const disc = (discountPct || 0) / 100;

        const ws = wb.addWorksheet('INDOOR_led лифт', {
            properties: { defaultRowHeight: 12 },
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        const widths = { A: 1.9, B: 7.3, C: 37, D: 12.3, E: 6.9, F: 13.1, G: 13.6, H: 7, I: 11.1, J: 7.1, K: 11, L: 11.3, M: 11, N: 8.9 };
        ws.columns = Object.keys(widths).map(k => ({ key: k, width: widths[k] }));

        // Шапка документа
        const lblStyle = { font: FONT_TXT_B, alignment: { horizontal: 'right' } };
        const valStyle = { font: FONT_TXT };
        set(ws, 'D3', 'Медиа:', lblStyle); set(ws, 'E3', 'INDOOR', valStyle);
        set(ws, 'D4', 'Бренд:', lblStyle); set(ws, 'E4', (clientName || '').trim() || 'Клиент', valStyle);
        set(ws, 'D5', 'Период:', lblStyle); set(ws, 'E5', days + ' дней', valStyle);
        set(ws, 'D6', 'Город:', lblStyle);
        const cities = [];
        groups.forEach(g => { if (!cities.includes(g.city)) cities.push(g.city); });
        set(ws, 'E6', cities.join(', '), valStyle);

        // Заголовок таблицы
        const headers = {
            B: 'Город', C: 'Класс сектора', D: 'Диагональ монитора', E: 'Хроно, сек',
            F: 'Кол-во мониторов по секторам',
            G: 'Цена за 1 день (за сектор)          ' + vatLabel,
            H: 'Скидка %',
            I: 'Цена за 1 день после скидки          ' + vatLabel,
            J: 'Кол-во дней', K: 'Кол-во выходов в день на одном мониторе',
            L: 'Общее кол-во выходов',
            M: 'Итого KZT           ' + vatLabel
        };
        Object.keys(headers).forEach(col => set(ws, col + '10', headers[col], S_TABLE_HDR));
        ws.getRow(10).height = 60;

        let r = 11;
        const subtotalRows = [];

        groups.forEach(group => {
            const start = r;
            // В маленьких группах строки выше, чтобы объединённая «Диагональ монитора» не обрезалась
            const rowH = group.sectors.length === 1 ? 45 : group.sectors.length === 2 ? 24 : 15;
            group.sectors.forEach(sec => {
                const perDay = includeVat ? 1.16 * sec.basePrice30d / 30 : sec.basePrice30d / 30;
                const afterDisc = perDay * (1 - disc);
                const gFormula = includeVat ? ('1.16*' + sec.basePrice30d + '/30') : (sec.basePrice30d + '/30');
                set(ws, 'B' + r, group.city, S_DATA_TXT);
                set(ws, 'C' + r, sec.name, S_DATA_TXT);
                set(ws, 'D' + r, null, S_DATA_TXT); // объединяется ниже
                set(ws, 'E' + r, 15, S_DATA);
                set(ws, 'F' + r, sec.monitors, S_DATA);
                set(ws, 'G' + r, fx(gFormula, perDay), S_DATA);
                set(ws, 'H' + r, disc > 0 ? disc : null, S_DATA_PCT);
                set(ws, 'I' + r, fx('G' + r + '*(1-H' + r + ')', afterDisc), S_DATA);
                set(ws, 'J' + r, days, S_DATA);
                set(ws, 'K' + r, 288, S_DATA);
                set(ws, 'L' + r, fx('K' + r + '*F' + r + '*J' + r, 288 * sec.monitors * days), S_DATA);
                set(ws, 'M' + r, fx('I' + r + '*J' + r, afterDisc * days), Object.assign({}, S_DATA, { font: FONT_TXT_B }));
                ws.getRow(r).height = rowH;
                r++;
            });
            const end = r - 1;
            // Диагональ монитора — объединённая ячейка на группу
            if (end > start) ws.mergeCells('D' + start + ':D' + end);
            set(ws, 'D' + start, group.diagonal, S_DATA_TXT);

            // Итоговая строка группы
            const sumRes = col => group.sectors.reduce((s, sec) => {
                const perDay = includeVat ? 1.16 * sec.basePrice30d / 30 : sec.basePrice30d / 30;
                const afterDisc = perDay * (1 - disc);
                if (col === 'F') return s + sec.monitors;
                if (col === 'G') return s + perDay;
                if (col === 'I') return s + afterDisc;
                if (col === 'L') return s + 288 * sec.monitors * days;
                return s + afterDisc * days; // M
            }, 0);
            set(ws, 'B' + r, null, S_SUBTOTAL);
            set(ws, 'C' + r, 'Итого: ' + group.label, S_SUBTOTAL_LBL);
            set(ws, 'D' + r, null, S_SUBTOTAL);
            set(ws, 'E' + r, null, S_SUBTOTAL);
            ['F', 'G', 'I', 'L', 'M'].forEach(col => {
                set(ws, col + r, fx('SUM(' + col + start + ':' + col + end + ')', sumRes(col)), S_SUBTOTAL);
            });
            set(ws, 'H' + r, null, Object.assign({}, S_SUBTOTAL, { numFmt: '0%' }));
            ws.mergeCells('J' + r + ':K' + r);
            set(ws, 'J' + r, null, S_SUBTOTAL);
            ws.getRow(r).height = 15;
            subtotalRows.push(r);
            r++;
        });

        // Общий итог
        const totalRow = r;
        ws.mergeCells('B' + totalRow + ':D' + totalRow);
        set(ws, 'B' + totalRow, 'Итого:', Object.assign({}, S_TOTAL, { numFmt: undefined }));
        set(ws, 'C' + totalRow, null, S_TOTAL); set(ws, 'D' + totalRow, null, S_TOTAL);
        set(ws, 'E' + totalRow, null, S_TOTAL);
        ['F', 'G', 'I', 'L', 'M'].forEach(col => {
            const formula = subtotalRows.map(sr => col + sr).join('+');
            let result = 0;
            subtotalRows.forEach(sr => { const v = ws.getCell(col + sr).value; result += (v && v.result) || 0; });
            set(ws, col + totalRow, fx(formula, result), S_TOTAL);
        });
        set(ws, 'H' + totalRow, null, Object.assign({}, S_TOTAL, { numFmt: '0%' }));
        ws.mergeCells('J' + totalRow + ':K' + totalRow);
        set(ws, 'J' + totalRow, null, S_TOTAL);
        ws.getRow(totalRow).height = 15;

        // Блок с картами
        let br = totalRow + 1;
        set(ws, 'B' + br, 'Карта с ЖК и БЦ, где установлены мониторы:', { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFF0000' } } });
        br++;
        const LINK_FONT = { name: 'Calibri', size: 11, color: { argb: 'FF1155CC' }, underline: true };
        const addLink = (label, url) => {
            set(ws, 'B' + br, label, { font: FONT_TXT }); br++;
            set(ws, 'B' + br, { text: url, hyperlink: url }, { font: LINK_FONT });
            ws.getRow(br).height = 15; br++;
        };
        if (cities.includes('Алматы')) addLink('Алматы:', 'https://goo.gl/maps/oBpqdHWYyTajPoNZ9?g_st=aw');
        if (cities.includes('Астана')) {
            addLink('Астана 1 часть:', 'https://goo.gl/maps/V6hN6qwH9efVEck26?g_st=aw');
            addLink('Астана 2 часть:', 'https://goo.gl/maps/axHPFgQUBZ4d4L5Y7?g_st=aw');
        }

        // Подписи размеров мониторов + фото
        const capRow = br + 1;
        set(ws, 'B' + capRow, '43 дюйма (110 см) ', { font: FONT_TXT });
        set(ws, 'D' + capRow, '15.6 дюймов (40 см)', { font: FONT_TXT });
        set(ws, 'G' + capRow, '21.5 дюймов (55 см)', { font: FONT_TXT });

        if (media) {
            const addImg = (entry, tl, ext) => {
                if (!entry) return;
                const id = wb.addImage({ buffer: entry.buffer, extension: entry.extension });
                ws.addImage(id, { tl: tl, ext: ext, editAs: 'oneCell' });
            };
            addImg(media.logo, { col: 1.02, row: 0.05 }, { width: 145, height: 140 });
            addImg(media.img156, { col: 2.95, row: capRow + 0.65 }, { width: 123, height: 129 });
            addImg(media.img215, { col: 6.06, row: capRow + 1.28 }, { width: 128, height: 110 });
            addImg(media.img43, { col: 1.07, row: capRow + 1.6 }, { width: 125, height: 285 });
        }
        return ws;
    }

    // ------------------------------------------------------------
    // Лист «АП - <Город> ЖК»
    // sectors: [{name, houses: [{name, address, monitors, entrances, floors, apartments}]}]
    // ------------------------------------------------------------
    function buildApJkSheet(wb, city, sectors) {
        const ws = wb.addWorksheet('АП - ' + city + ' ЖК', {
            properties: { defaultRowHeight: 12 },
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        const widths = { A: 2.1, B: 10.7, C: 30.3, D: 42.6, E: 9.9, F: 11.1, G: 9.9, H: 9.9 };
        ws.columns = Object.keys(widths).map(k => ({ key: k, width: widths[k] }));

        const S_TITLE = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TH = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_CELL = { font: FONT_TXT, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_SECTOR = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TOT = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TOT_LBL = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: { horizontal: 'right', vertical: 'middle', wrapText: true } };

        ws.mergeCells('B2:H2');
        set(ws, 'B2', 'Общая Адресная программа ЖК по г. ' + city, S_TITLE);
        ws.mergeCells('B3:H3');
        set(ws, 'B3', 'Длительность роликов 15 секунд, на казахском и русском языках / 1 выход каждую 5-ю минуту', S_TITLE);
        ws.mergeCells('B4:B5'); ws.mergeCells('C4:C5'); ws.mergeCells('D4:D5'); ws.mergeCells('E4:H4');
        set(ws, 'B4', 'Сектор', S_TH); set(ws, 'C4', 'Название ЖК', S_TH); set(ws, 'D4', 'Адрес ЖК/ район', S_TH);
        set(ws, 'E4', 'Общее количество', S_TH);
        set(ws, 'E5', 'Мониторов', S_TH); set(ws, 'F5', 'Подъездов', S_TH); set(ws, 'G5', 'Этажей', S_TH); set(ws, 'H5', 'квартир', S_TH);
        ws.getRow(5).height = 24;

        let r = 6;
        const totRows = [];
        let totalHousesCount = 0;
        sectors.forEach(sec => {
            const hs = r;
            sec.houses.forEach(h => {
                set(ws, 'B' + r, null, S_CELL);
                set(ws, 'C' + r, h.name, S_CELL);
                set(ws, 'D' + r, h.address || '', S_CELL);
                set(ws, 'E' + r, h.monitors || 0, S_CELL);
                set(ws, 'F' + r, h.entrances || 0, S_CELL);
                set(ws, 'G' + r, h.floors != null ? String(h.floors) : '', Object.assign({}, S_CELL, { numFmt: '@' }));
                set(ws, 'H' + r, h.apartments || 0, S_CELL);
                r++;
            });
            const he = r - 1;
            totalHousesCount += sec.houses.length;
            if (he > hs) ws.mergeCells('B' + hs + ':B' + he);
            set(ws, 'B' + hs, sec.name, S_SECTOR);
            // Итого по сектору
            ws.mergeCells('B' + r + ':D' + r);
            set(ws, 'B' + r, 'Итого (' + sec.houses.length + ' ЖК):', S_TOT_LBL);
            set(ws, 'C' + r, null, S_TOT); set(ws, 'D' + r, null, S_TOT);
            const sum = key => sec.houses.reduce((s, h) => s + (+h[key] || 0), 0);
            set(ws, 'E' + r, fx('SUM(E' + hs + ':E' + he + ')', sum('monitors')), S_TOT);
            set(ws, 'F' + r, fx('SUM(F' + hs + ':F' + he + ')', sum('entrances')), S_TOT);
            set(ws, 'G' + r, null, S_TOT);
            set(ws, 'H' + r, fx('SUM(H' + hs + ':H' + he + ')', sum('apartments')), Object.assign({}, S_TOT, { numFmt: '#,##0' }));
            totRows.push(r);
            r++;
        });
        // Итог по всем секторам
        ws.mergeCells('B' + r + ':D' + r);
        set(ws, 'B' + r, 'Итого по всем секторам (' + totalHousesCount + ' ЖК):', S_TOT_LBL);
        set(ws, 'C' + r, null, S_TOT); set(ws, 'D' + r, null, S_TOT);
        ['E', 'F', 'H'].forEach(col => {
            const formula = totRows.map(tr => col + tr).join('+');
            let result = 0;
            totRows.forEach(tr => { const v = ws.getCell(col + tr).value; result += (v && v.result) || 0; });
            set(ws, col + r, fx(formula, result), Object.assign({}, S_TOT, col === 'H' ? { numFmt: '#,##0' } : {}));
        });
        set(ws, 'G' + r, null, S_TOT);
        return ws;
    }

    // ------------------------------------------------------------
    // Лист «АП - <Город> БЦ»
    // sectors: [{name, houses: [{name, address, monitorsLift, monitorsHall, floors, orgs}]}]
    // ------------------------------------------------------------
    function buildApBcSheet(wb, city, sectors) {
        const ws = wb.addWorksheet('АП - ' + city + ' БЦ', {
            properties: { defaultRowHeight: 12 },
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        const widths = { A: 2.1, B: 15.7, C: 40.7, D: 9.9, E: 9.9, F: 9.9, G: 12.9 };
        ws.columns = Object.keys(widths).map(k => ({ key: k, width: widths[k] }));

        const S_TITLE = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TH = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_CELL = { font: FONT_TXT, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_NAME = { font: FONT_HDR, fill: FILL_GREEN, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TOT = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: CENTER_WRAP };
        const S_TOT_LBL = { font: FONT_HDR, fill: FILL_DARK, border: BORDER_ALL, alignment: { horizontal: 'right', vertical: 'middle', wrapText: true } };

        ws.mergeCells('B2:G2');
        set(ws, 'B2', 'Общая Адресная программа БЦ по г. ' + city, S_TITLE);
        ws.mergeCells('B3:G3');
        set(ws, 'B3', 'Длительность роликов 15 секунд, на казахском и русском языках / 1 выход каждую 5-ю минуту', S_TITLE);
        ws.mergeCells('B4:B5'); ws.mergeCells('C4:C5'); ws.mergeCells('D4:G4');
        set(ws, 'B4', 'Бизнес центр', S_TH); set(ws, 'C4', 'Адрес БЦ/ район', S_TH);
        set(ws, 'D4', 'Общее количество', S_TH);
        set(ws, 'D5', 'Мониторы в лифтах', S_TH); set(ws, 'E5', 'Мониторы в холлах', S_TH);
        set(ws, 'F5', 'Этажей', S_TH); set(ws, 'G5', 'Организаций', S_TH);
        ws.getRow(5).height = 24;

        let r = 6;
        const totRows = [];
        let totalBcCount = 0;
        sectors.forEach(sec => {
            const hs = r;
            sec.houses.forEach(h => {
                set(ws, 'B' + r, h.name, S_NAME);
                set(ws, 'C' + r, h.address || '', S_CELL);
                set(ws, 'D' + r, h.monitorsLift || 0, S_CELL);
                set(ws, 'E' + r, h.monitorsHall || 0, S_CELL);
                set(ws, 'F' + r, h.floors != null ? String(h.floors) : '', Object.assign({}, S_CELL, { numFmt: '@' }));
                set(ws, 'G' + r, h.orgs || 0, S_CELL);
                ws.getRow(r).height = 24;
                r++;
            });
            const he = r - 1;
            totalBcCount += sec.houses.length;
            // Итого по БЦ
            ws.mergeCells('B' + r + ':C' + r);
            set(ws, 'B' + r, 'Итого (' + sec.houses.length + ' БЦ):', S_TOT_LBL);
            set(ws, 'C' + r, null, S_TOT);
            ws.mergeCells('D' + r + ':E' + r);
            const sumLifts = sec.houses.reduce((s, h) => s + (+h.monitorsLift || 0) + (+h.monitorsHall || 0), 0);
            const sumOrgs = sec.houses.reduce((s, h) => s + (+h.orgs || 0), 0);
            set(ws, 'D' + r, fx('SUM(D' + hs + ':E' + he + ')', sumLifts), S_TOT);
            set(ws, 'E' + r, null, S_TOT);
            set(ws, 'F' + r, sec.houses.length === 1 ? fx('F' + hs, sec.houses[0].floors != null ? String(sec.houses[0].floors) : '') : null, S_TOT);
            set(ws, 'G' + r, fx('SUM(G' + hs + ':G' + he + ')', sumOrgs), S_TOT);
            totRows.push(r);
            r++;
        });
        // Итог по всем БЦ
        ws.mergeCells('B' + r + ':C' + r);
        set(ws, 'B' + r, 'Итого по всем БЦ (' + totalBcCount + ' БЦ):', S_TOT_LBL);
        set(ws, 'C' + r, null, S_TOT);
        ws.mergeCells('D' + r + ':E' + r);
        const fD = totRows.map(tr => 'D' + tr).join('+');
        const fG = totRows.map(tr => 'G' + tr).join('+');
        let rD = 0, rG = 0;
        totRows.forEach(tr => {
            const vD = ws.getCell('D' + tr).value; rD += (vD && vD.result) || 0;
            const vG = ws.getCell('G' + tr).value; rG += (vG && vG.result) || 0;
        });
        set(ws, 'D' + r, fx(fD, rD), S_TOT);
        set(ws, 'E' + r, null, S_TOT);
        set(ws, 'F' + r, null, S_TOT);
        set(ws, 'G' + r, fx(fG, rG), S_TOT);
        return ws;
    }

    // ------------------------------------------------------------
    // Сборка книги целиком.
    // opts: { clientName, days, discountPct, includeVat, groups,
    //         addressPrograms: { 'Астана': {jk: [...], bc: [...]}, 'Алматы': {...} } | null,
    //         media }
    // ------------------------------------------------------------
    async function buildSmetaWorkbook(ExcelJS, opts) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'LiftMedia';
        wb.created = new Date();
        wb.calcProperties.fullCalcOnLoad = true;

        buildMainSheet(wb, opts, opts.media || null);

        if (opts.addressPrograms) {
            const ap = opts.addressPrograms;
            ['Астана', 'Алматы'].forEach(city => {
                if (!ap[city]) return;
                if (ap[city].jk && ap[city].jk.length) buildApJkSheet(wb, city, ap[city].jk);
                if (ap[city].bc && ap[city].bc.length) buildApBcSheet(wb, city, ap[city].bc);
            });
        }
        return wb;
    }

    return { buildSmetaWorkbook, fetchSmetaMedia };
});
