-- Artifacts the hero owns. The artifact catalog itself lives in code (src/game/artifacts.ts).
CREATE TABLE hero_artifacts (
  hero_id     BIGINT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  artifact_id TEXT   NOT NULL,
  source      TEXT   NOT NULL CHECK (source IN ('starter', 'drop', 'craft')),
  -- Artifacts level up separately from the hero.
  level       INT    NOT NULL DEFAULT 1,
  experience  INT    NOT NULL DEFAULT 0,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hero_id, artifact_id)
);

-- Shards of artifacts the hero does not own yet; enough shards craft the artifact.
CREATE TABLE artifact_shards (
  hero_id     BIGINT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  artifact_id TEXT   NOT NULL,
  amount      INT    NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (hero_id, artifact_id)
);

ALTER TABLE heroes ADD COLUMN equipped_artifact TEXT;
-- Bot battles are counted separately from PvP wins/losses.
ALTER TABLE heroes ADD COLUMN bot_wins   INT NOT NULL DEFAULT 0;
ALTER TABLE heroes ADD COLUMN bot_losses INT NOT NULL DEFAULT 0;

-- Battles. The whole battle state is a JSON document handled by src/game/battle.ts.
CREATE TABLE battles (
  id          BIGSERIAL PRIMARY KEY,
  hero_id     BIGINT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  mode        TEXT   NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot')),
  status      TEXT   NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  state       JSONB  NOT NULL,
  rewards     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
-- At most one unfinished battle per hero.
CREATE UNIQUE INDEX battles_one_active_per_hero ON battles (hero_id) WHERE status = 'active';
CREATE INDEX battles_hero_created_idx ON battles (hero_id, created_at DESC);
