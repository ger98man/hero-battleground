-- Game version 0.1: classes replace "artifact = class".
-- The hero build (classes with rank and specialization, talents, skill loadout) is one JSON document
-- validated in code (src/game/build.ts); stats are derived from level + build.
ALTER TABLE heroes ADD COLUMN build JSONB NOT NULL DEFAULT '{"classes": [], "talents": [], "loadout": []}';

-- Battles in progress use the old state format and cannot continue; close them without rewards.
UPDATE battles SET status = 'lost', finished_at = now(), updated_at = now() WHERE status = 'active';

-- hero_artifacts / artifact_shards / heroes.equipped_artifact / health / attack / defense / speed are no longer used.
-- They are kept for now; artifacts come back later as equipment.
