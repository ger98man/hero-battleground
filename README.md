# Hero Battleground

Браузерная PvP-игра (в планах режимы 1×1, 2×2, 3×3). Сейчас готова стартовая сборка:
регистрация и вход, у каждого игрока есть герой со страницей характеристик.

**Стек:** TypeScript, Node.js 22, Express 5, PostgreSQL, деплой на Render.

## Что внутри

- `src/server.ts` — точка входа: применяет миграции и запускает сервер.
- `src/routes/auth.ts` — `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`.
- `src/routes/hero.ts` — `GET /api/hero`, герой текущего игрока.
- `src/db/migrate.ts` — простой мигратор: применяет файлы `migrations/*.sql` по порядку и запоминает их в таблице `schema_migrations`.
- `src/realtime/chat.ts` — WebSocket `/ws`: счётчик онлайна и общий чат (таблица `chat_messages`, хранятся последние 200 сообщений канала, при входе показываются 20). `postSystemMessage()` пишет системные строки вроде «Новый игрок: …». Онлайн считается в памяти процесса, поэтому рассчитано на один инстанс сервера.
- `src/routes/players.ts` — `GET /api/online` (число игроков онлайн, без входа) и `GET /api/heroes/:name` (профиль чужого героя, страница `/heroes/:name`).
- `public/` — страницы `/login` и `/hero` (обычный HTML + JS, без фреймворка).

Пароли хэшируются bcrypt. Сессии хранятся в PostgreSQL (таблица `user_sessions`), в браузере только httpOnly-cookie.

## Локальный запуск

Нужны Node.js 20+ и PostgreSQL.

```bash
# 1. База данных
createdb hero_battleground

# 2. Настройки
cp .env.example .env      # при необходимости поправьте DATABASE_URL

# 3. Зависимости и запуск в режиме разработки
npm install
npm run dev               # http://localhost:3000
```

Миграции применяются автоматически при старте. Вручную: `npm run migrate:dev` (или `npm run migrate` после `npm run build`).

Новая миграция — это новый файл `migrations/NNN_описание.sql` со следующим номером. Уже применённые файлы не меняйте.

### Postgres через Docker

```bash
docker run -d --name hb-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hero_battleground postgres:16
```

## Деплой на Render

1. В Render: **New → Blueprint**, выберите этот репозиторий.
2. Render прочитает `render.yaml` и создаст веб-сервис и базу PostgreSQL (бесплатные планы). `SESSION_SECRET` сгенерируется сам, `DATABASE_URL` подставится из базы.
3. После деплоя откройте адрес сервиса и зарегистрируйтесь.

Учтите: бесплатная база Render удаляется через 30 дней, а бесплатный сервис засыпает без трафика.

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | запуск с автоперезагрузкой (tsx) |
| `npm run build` | сборка TypeScript в `dist/` |
| `npm start` | запуск собранной версии |
| `npm run typecheck` | проверка типов |
| `npm run migrate` / `migrate:dev` | применить миграции |
