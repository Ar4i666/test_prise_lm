const axios = require('axios');
const path = require('path');
require('dotenv').config();

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'https://cloud.liftmedia.kz';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USER;
const NEXTCLOUD_PASSWORD = process.env.NEXTCLOUD_PASSWORD;
const NEXTCLOUD_FOLDER = process.env.NEXTCLOUD_FOLDER || '/КП/2026/';

const getAuthOptions = () => ({
    username: NEXTCLOUD_USER,
    password: NEXTCLOUD_PASSWORD
});

/**
 * Загружает файл в Nextcloud через WebDAV
 * @param {string} filename Имя файла (например, 'proposal_123.pdf')
 * @param {Buffer} fileBuffer Содержимое файла
 * @returns {Promise<string>} Возвращает путь файла в Nextcloud
 */
async function uploadFileToNextcloud(filename, fileBuffer) {
    try {
        // Формируем URL для WebDAV (кодируем имя файла, но оставляем слэши)
        const remotePath = `${NEXTCLOUD_FOLDER}${filename}`.replace(/\/+/g, '/');
        // Обязательно кодируем путь для URI, так как там могут быть пробелы и кириллица
        const encodedPath = encodeURI(remotePath);
        const webdavUrl = `${NEXTCLOUD_URL}/remote.php/webdav${encodedPath}`;

        await axios.put(webdavUrl, fileBuffer, {
            auth: getAuthOptions(),
            headers: {
                'Content-Type': 'application/octet-stream' // Или соответствующий mime-type
            }
        });

        console.log(`[Nextcloud] Файл успешно загружен: ${remotePath}`);
        return remotePath;
    } catch (error) {
        console.error(`[Nextcloud] Ошибка загрузки файла ${filename}:`, error.message);
        if (error.response) {
            console.error(`[Nextcloud] Детали:`, error.response.status, error.response.data);
        }
        throw error;
    }
}

/**
 * Создает публичную ссылку на файл в Nextcloud через OCS API
 * @param {string} filepath Путь к файлу (например, '/КП/2026/proposal_123.pdf')
 * @returns {Promise<string>} Возвращает публичный URL (public share link)
 */
async function createPublicShareLink(filepath) {
    try {
        const apiUrl = `${NEXTCLOUD_URL}/ocs/v1.php/apps/files_sharing/api/v1/shares`;
        
        // В Nextcloud OCS API требуется передать формат ответа
        const response = await axios.post(apiUrl, {
            path: filepath,
            shareType: 3 // 3 = public link
        }, {
            auth: getAuthOptions(),
            headers: {
                'OCS-APIRequest': 'true',
                'Accept': 'application/json'
            }
        });

        // OCS API может возвращать данные в разных форматах, мы ожидаем JSON
        const shareData = response.data.ocs.data;
        const publicUrl = shareData.url;
        
        console.log(`[Nextcloud] Публичная ссылка создана: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error(`[Nextcloud] Ошибка создания публичной ссылки для ${filepath}:`, error.message);
        if (error.response) {
            console.error(`[Nextcloud] Детали:`, error.response.status, error.response.data);
        }
        throw error;
    }
}

module.exports = {
    uploadFileToNextcloud,
    createPublicShareLink
};
