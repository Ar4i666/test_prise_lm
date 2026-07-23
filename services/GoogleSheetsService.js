const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.SPREADSHEET_ID;
    this.credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_CREDENTIALS_FILE || './credentials.json');
    this.auth = null;
    this.sheets = null;
  }

  async _authenticate() {
    if (this.auth) return;

    if (!fs.existsSync(this.credentialsPath)) {
      throw new Error(`Файл учетных данных Google не найден по пути: ${this.credentialsPath}. Ознакомьтесь с google-api-setup.md`);
    }

    this.auth = new google.auth.GoogleAuth({
      keyFile: this.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Получает данные из указанного диапазона таблицы.
   * @param {string} range Например: 'Лист1!A1:E10'
   */
  async getSheetData(range) {
    await this._authenticate();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      return response.data.values;
    } catch (error) {
      console.error('Ошибка при получении данных из Google Sheets:', error.message);
      throw error;
    }
  }

  /**
   * Получает список всех листов в таблице.
   */
  async getSpreadsheetInfo() {
    await this._authenticate();
    
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return response.data.sheets.map(sheet => sheet.properties.title);
    } catch (error) {
      console.error('Ошибка при получении информации о таблице:', error.message);
      throw error;
    }
  }

  /**
   * Получает очищенный и структурированный список домов из таблицы.
   */
  async getParsedAddressProgram() {
    const sheetNames = await this.getSpreadsheetInfo();
    const parsedData = [];

    for (const sheetName of sheetNames) {
      const isBC = sheetName.toLowerCase().startsWith('bc') || sheetName.toLowerCase().includes('бц');

      try {
        const rows = await this.getSheetData(`${sheetName}!A1:Z500`);
        if (!rows || rows.length === 0) continue;

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const r = rows[i];
          if (r.length > 1 && (r[0] === 'Сектор' || r[1] === 'Название ЖК' || r[1] === 'Бизнес центр')) {
            headerRowIndex = i;
            break;
          }
        }

        const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 2;
        let currentSector = '';

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          
          if (row[0] && row[0].trim() !== '') {
            currentSector = row[0].trim();
          }

          const name = row[1]; // Название ЖК/БЦ (Колонка B)
          const sector = isBC ? name : currentSector;
          const address = row[2]; // Адрес (Колонка C)
          
          let monitors = 0;
          let entrances = 0;
          let floors = '';
          let apartments = 0;

          if (isBC) {
            monitors = (parseInt(row[3]) || 0) + (parseInt(row[4]) || 0); // лифты + холлы
            entrances = 0; 
            floors = row[5] || '';
            apartments = parseInt(row[6]) || 0; // организаций
          } else {
            monitors = parseInt(row[3]) || 0;
            entrances = parseInt(row[4]) || 0;
            floors = row[5] || '';
            apartments = parseInt(row[6]) || 0;
          }

          if (!name || name.trim() === '' || name.toLowerCase().includes('итого') || name === 'Название ЖК' || name === 'Бизнес центр' || row[3] === 'Мониторов') {
            continue;
          }

          parsedData.push({
            sheet_name: sheetName,
            sheet_sector_name: sector ? sector.trim() : '',
            sheet_house_name: name.trim(),
            sheet_address: address ? address.trim() : '',
            sheet_monitors: monitors,
            sheet_entrances: entrances,
            sheet_floors: floors.trim(),
            sheet_apartments: apartments,
            sheet_monitors_lift: isBC ? (parseInt(row[3]) || 0) : monitors,
            sheet_monitors_hall: isBC ? (parseInt(row[4]) || 0) : 0
          });
        }
      } catch (e) {
        console.error(`Ошибка при парсинге листа ${sheetName}:`, e.message);
      }
    }

    return parsedData;
  }
}

module.exports = new GoogleSheetsService();
