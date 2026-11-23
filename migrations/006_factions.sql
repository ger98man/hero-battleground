-- Factions 0.1: the hero picks one faction (for good) and one of its four heroes,
-- and keeps an army of that faction's units. Rules are checked in code (src/game/factions.ts).
ALTER TABLE heroes ADD COLUMN faction TEXT;
ALTER TABLE heroes ADD COLUMN faction_hero TEXT;
ALTER TABLE heroes ADD COLUMN army JSONB NOT NULL DEFAULT '[]';
