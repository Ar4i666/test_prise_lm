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
 * Создаёт папку в Nextcloud через WebDAV MKCOL, по сегментам пути —
 * каждый уровень независимо (MKCOL требует, чтобы родитель уже
 * существовал). Уже существующая папка — не ошибка (Nextcloud отвечает
 * 405 Method Not Allowed), молча пропускаем; реальные ошибки (401/403 и
 * т.п.) пробрасываем дальше.
 * @param {string} folderPath Например, '/КП/2026/<opportunityId>/'
 */
async function ensureRemoteFolder(folderPath) {
    const segments = folderPath.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
        current += `/${segment}`;
        const encodedPath = encodeURI(current);
        const webdavUrl = `${NEXTCLOUD_URL}/remote.php/webdav${encodedPath}`;
        try {
            await axios.request({
                method: 'MKCOL',
                url: webdavUrl,
                auth: getAuthOptions(),
            });
        } catch (error) {
            const status = error.response && error.response.status;
            if (status === 405) {
                // Папка уже существует — нормальный случай при повторной
                // генерации КП для той же сделки.
                continue;
            }
            console.error(`[Nextcloud] Ошибка создания папки ${current}:`, error.message);
            throw error;
        }
    }
}

/**
 * Загружает файл в Nextcloud через WebDAV
 * @param {string} filename Имя файла (например, 'proposal_123.pdf')
 * @param {Buffer} fileBuffer Содержимое файла
 * @param {string} [subfolder] Подпапка внутри NEXTCLOUD_FOLDER (например,
 *   id сделки) — если задана, файл кладётся в неё, а не в общую плоскую
 *   папку. Папка создаётся автоматически, если её ещё нет.
 * @returns {Promise<string>} Возвращает путь файла в Nextcloud
 */
async function uploadFileToNextcloud(filename, fileBuffer, subfolder) {
    try {
        const folder = subfolder
            ? `${NEXTCLOUD_FOLDER}${subfolder}/`.replace(/\/+/g, '/')
            : NEXTCLOUD_FOLDER;
        if (subfolder) {
            await ensureRemoteFolder(folder);
        }
        // Формируем URL для WebDAV (кодируем имя файла, но оставляем слэши)
        const remotePath = `${folder}${filename}`.replace(/\/+/g, '/');
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

/**
 * Ищет уже существующую публичную ссылку на путь (файл или папку) через
 * OCS API. Нужно для "одна папка на сделку, одна ссылка на неё навсегда" —
 * без этого каждая повторная генерация КП создавала бы ещё один share на
 * ту же папку (Nextcloud такое разрешает, но плодит мусорные ссылки).
 * @param {string} itemPath
 * @returns {Promise<string|null>} URL существующей публичной ссылки или null
 */
async function findExistingPublicShareLink(itemPath) {
    try {
        const apiUrl = `${NEXTCLOUD_URL}/ocs/v1.php/apps/files_sharing/api/v1/shares`;
        const response = await axios.get(apiUrl, {
            params: { path: itemPath, reshares: false },
            auth: getAuthOptions(),
            headers: {
                'OCS-APIRequest': 'true',
                'Accept': 'application/json',
            },
        });
        const shares = (response.data.ocs && response.data.ocs.data) || [];
        const publicShare = shares.find((s) => Number(s.share_type) === 3);
        return publicShare ? publicShare.url : null;
    } catch (error) {
        console.error(`[Nextcloud] Ошибка поиска существующей ссылки для ${itemPath}:`, error.message);
        return null;
    }
}

/**
 * Отдаёт публичную ссылку на папку — переиспользует уже существующую
 * (если это не первая генерация КП для этой сделки), иначе создаёт новую.
 * @param {string} folderPath Например, '/КП/2026/<opportunityId>/'
 * @returns {Promise<string>}
 */
async function getOrCreateFolderShareLink(folderPath) {
    const existing = await findExistingPublicShareLink(folderPath);
    if (existing) return existing;
    return createPublicShareLink(folderPath);
}

module.exports = {
    uploadFileToNextcloud,
    createPublicShareLink,
    getOrCreateFolderShareLink,
    ensureRemoteFolder,
};
