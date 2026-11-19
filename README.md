# Hero Battleground

Браузерная PvP-игра (в планах режимы 1×1, 2×2, 3×3). Сейчас есть: регистрация и вход,
страница героя, артефакты (класс героя) и пошаговый бой против бота на клеточном поле.

**Стек:** TypeScript, Node.js 22, Express 5, PostgreSQL, деплой на Render.

## Что внутри

- `src/server.ts` — точка входа: применяет миграции и запускает сервер.
- `src/routes/auth.ts` — `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`.
- `src/routes/hero.ts` — `GET /api/hero`, герой текущего игрока.
- `src/routes/artifacts.ts` — `GET /api/artifacts`, `POST /api/artifacts/starter` (выбор первого), `POST /api/artifacts/equip` (смена на свой).
- `src/routes/battle.ts` — `POST /api/battle` (начать бой с ботом), `GET /api/battle/current`, `GET /api/battle/:id`, `POST /api/battle/:id/action`.
- `src/game/artifacts.ts` — каталог артефактов и умений (названия и цифры меняются здесь).
- `src/game/battle.ts` — логика боя (сервер решает всё, клиент присылает только намерения), `src/game/bot.ts` — ИИ бота.
- `src/db/migrate.ts` — простой мигратор: применяет файлы `migrations/*.sql` по порядку и запоминает их в таблице `schema_migrations`.
- `public/` — страницы `/login`, `/hero` и `/battle` (обычный HTML + JS, без фреймворка).

## Как устроен бой

- Поле 10×7, пара камней-препятствий. Ход и дальность считаются с диагоналями (диагональ = 1 клетка).
- Игрок ходит первым. За ход: перемещение до N клеток (от артефакта и скорости), 1 действие и 1 бонусное действие.
- Мана +10 в начале своего хода. Эффекты: урон, лечение, щит, урон по времени, оглушение.
- Состояние боя хранится в `battles.state` (JSONB). Одновременно у героя может быть только один активный бой.
- Победа: +опыт, +1 победа и 30% шанс получить артефакт, которого у героя ещё нет. Поражение: немного опыта.

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
| `npm test` | тесты логики боя |
| `npm run migrate` / `migrate:dev` | применить миграции |
