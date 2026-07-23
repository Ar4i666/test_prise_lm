# Настройка доступа к Google Sheets API

Для того чтобы сервис мог читать данные из Google Таблиц, вам нужно создать Сервисный аккаунт в Google Cloud и получить JSON-файл с ключами.

### Шаг 1: Создание проекта и Сервисного аккаунта
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/).
2. Создайте новый проект (или выберите существующий).
3. В поиске вверху найдите **"Google Sheets API"** и нажмите **Enable** (Включить).
4. Перейдите в раздел **"APIs & Services" > "Credentials"**.
5. Нажмите **"Create Credentials" > "Service Account"**.
6. Введите любое имя (например, `price-list-service`) и нажмите **Create and Continue**, затем **Done**.

### Шаг 2: Получение JSON-ключа
1. В списке **Service Accounts** нажмите на созданный аккаунт.
2. Перейдите во вкладку **"Keys"**.
3. Нажмите **"Add Key" > "Create new key"**.
4. Выберите тип **JSON** и нажмите **Create**.
5. Файл будет скачан на ваш компьютер. **Переименуйте его в `credentials.json`** и положите в папку `Desktop/Прайс`.

### Шаг 3: Доступ к таблице
1. Откройте скачанный JSON-файл и найдите там поле `"client_email"` (оно выглядит как `price-list-service@project-id.iam.gserviceaccount.com`).
2. Скопируйте этот email.
3. Откройте вашу Google Таблицу в браузере.
4. Нажмите кнопку **"Share"** (Поделиться) в правом верхнем углу.
5. Вставьте скопированный email и дайте ему права **"Viewer"** (Читатель).

### Шаг 4: Настройка .env
Убедитесь, что в вашем файле `.env` указаны правильные значения:
```env
SPREADSHEET_ID=1e6elp854cwHkd6R07bMYzLlb6DhCI3GGB2VffrebHwM
GOOGLE_CREDENTIALS_FILE=./credentials.json
```

После этого сервис сможет подключаться к вашей таблице!
