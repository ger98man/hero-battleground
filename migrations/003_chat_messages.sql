-- Chat. `channel` lets trade/clan/team channels (and later private messages) reuse this table.
-- System messages (battle results, new players) have kind = 'system' and no user_id.
CREATE TABLE chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  channel    TEXT NOT NULL DEFAULT 'global',
  kind       TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system')),
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'user') = (user_id IS NOT NULL))
);
CREATE INDEX chat_messages_channel_id_idx ON chat_messages (channel, id DESC);
