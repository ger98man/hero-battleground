-- PvP 1x1: a battle between two heroes. `hero_id` plays the "player" side (challenge creator),
-- `opponent_hero_id` plays the "bot" side. `status` is from the creator's point of view.
ALTER TABLE battles DROP CONSTRAINT battles_mode_check;
ALTER TABLE battles ADD CONSTRAINT battles_mode_check CHECK (mode IN ('bot', 'pvp'));
ALTER TABLE battles ADD COLUMN opponent_hero_id BIGINT REFERENCES heroes(id) ON DELETE CASCADE;
-- PvP turn timer: when the current turn ends automatically.
ALTER TABLE battles ADD COLUMN turn_deadline TIMESTAMPTZ;
ALTER TABLE battles ADD CONSTRAINT battles_pvp_opponent CHECK ((mode = 'pvp') = (opponent_hero_id IS NOT NULL));
CREATE UNIQUE INDEX battles_one_active_per_opponent ON battles (opponent_hero_id) WHERE status = 'active';
CREATE INDEX battles_pvp_deadline_idx ON battles (turn_deadline) WHERE status = 'active' AND mode = 'pvp';

-- Open challenges ("заявки"): anyone of the same hero level can join; the battle starts at once.
CREATE TABLE battle_challenges (
  id               BIGSERIAL PRIMARY KEY,
  hero_id          BIGINT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  mode             TEXT   NOT NULL DEFAULT '1v1' CHECK (mode IN ('1v1')),
  level            INT    NOT NULL,
  status           TEXT   NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'started', 'cancelled', 'expired')),
  opponent_hero_id BIGINT REFERENCES heroes(id) ON DELETE SET NULL,
  battle_id        BIGINT REFERENCES battles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  closed_at        TIMESTAMPTZ
);
-- At most one open challenge per hero.
CREATE UNIQUE INDEX battle_challenges_one_open_per_hero ON battle_challenges (hero_id) WHERE status = 'open';
CREATE INDEX battle_challenges_open_idx ON battle_challenges (expires_at) WHERE status = 'open';
