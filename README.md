# kirgoldman-bot

Telegram-бот для kirgoldman.com. Деплой в один клик через Cloudflare.

## Как задеплоить

### 1. Создать репозиторий на GitHub

1. Зайди на [github.com](https://github.com) → **New repository**.
2. Имя: `kirgoldman-bot`, оставь **Public** (иначе кнопка деплоя не сможет прочитать файлы) → **Create repository**.
3. На странице пустого репозитория нажми **uploading an existing file** и загрузи туда три файла из этой папки: `worker.js`, `wrangler.toml`, и папку `migrations` целиком (файл `migrations/0001_init.sql`) — так же, как ты загружаешь файлы сайта через GitHub web-редактор.
4. **Commit changes**.

### 2. Нажать кнопку деплоя

Замени в ссылке ниже `YOUR-USERNAME` на свой логин GitHub, открой её в браузере:

```
https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR-USERNAME/kirgoldman-bot
```

Откроется страница Cloudflare — войди тем же аккаунтом, что и на сайте, нажми **Deploy**. Cloudflare сам:
- создаст воркер
- создаст базу данных D1 и накатит `migrations/0001_init.sql`
- привяжет базу к воркеру
- включит расписание (Cron Trigger) из `wrangler.toml`

### 3. Что доделать руками (2 вещи)

После деплоя открой созданный воркер в Cloudflare (**Workers & Pages** → `kirgoldman-bot`):

**а) Токен бота**
Settings → Variables and Secrets → Add variable → тип **Secret** → имя `BOT_TOKEN` → значение — токен из BotFather → Save and deploy.

**б) Адрес воркера**
На странице воркера сверху виден его адрес (`https://kirgoldman-bot.твой-субдомен.workers.dev`). Settings → Variables and Secrets → найди `BASE_URL` → Edit → впиши этот адрес → Save and deploy.

### 4. Подключить вебхук Telegram

Открой в браузере (замени `<BOT_TOKEN>` и `<WORKER_URL>`):

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/webhook
```

Должно появиться `{"ok":true,...}`.

Готово — бот работает. Тексты сообщений и тайминги можно менять прямо в файле `worker.js` на GitHub (кнопка карандаша → правка → Commit), Cloudflare подхватит изменения при повторном деплое той же кнопкой.
