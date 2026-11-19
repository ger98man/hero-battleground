-- Global chat. `channel` is here so trade/clan/team channels can be added later without a new table.
CREATE TABLE chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  channel    TEXT NOT NULL DEFAULT 'global',
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_channel_id_idx ON chat_messages (channel, id DESC);
