-- At most one ingestion job may be queued or running at a time.
-- The API also checks before inserting, but two requests arriving together can
-- both pass that check; this index makes the database reject the second insert.
-- (Prisma's schema language can't express partial indexes, so this is hand-written
-- SQL. Prisma leaves it alone: a later `migrate dev` generates no drop for it.)
CREATE UNIQUE INDEX "IngestionJob_one_active_key"
ON "IngestionJob" ((true))
WHERE status IN ('queued', 'running');
