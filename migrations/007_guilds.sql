-- Stats v2 and guilds (24.11.2026). Stats are still derived in code (src/game/build.ts);
-- guild levels add to them. The guild catalog lives in code (src/game/guilds.ts).
CREATE TABLE hero_guilds (
  hero_id  BIGINT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  guild_id TEXT   NOT NULL,
  level    INT    NOT NULL DEFAULT 0 CHECK (level >= 0),
  points   INT    NOT NULL DEFAULT 0 CHECK (points >= 0),
  -- Stats picked for each level (Союз Наёмников: strength / dexterity / intellect).
  picks    JSONB  NOT NULL DEFAULT '[]',
  PRIMARY KEY (hero_id, guild_id)
);
