CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));

CREATE TABLE heroes (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  level      INT  NOT NULL DEFAULT 1,
  experience INT  NOT NULL DEFAULT 0,
  health     INT  NOT NULL DEFAULT 100,
  attack     INT  NOT NULL DEFAULT 10,
  defense    INT  NOT NULL DEFAULT 5,
  speed      INT  NOT NULL DEFAULT 5,
  wins       INT  NOT NULL DEFAULT 0,
  losses     INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX heroes_name_lower_idx ON heroes (lower(name));

-- Session store for connect-pg-simple
CREATE TABLE user_sessions (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
