-- Migration 014: revoke privileges the public roles never needed
--
-- An earlier `grant all`-style statement (not present in any migration file in
-- this repo) had given anon and authenticated TRUNCATE, REFERENCES and TRIGGER
-- on every table in the public schema.
--
-- TRUNCATE is the notable one: it empties a table and, unlike delete, it is NOT
-- subject to row level security. It was never reachable from the internet —
-- PostgREST only exposes select/insert/update/delete — so this was a latent
-- over-grant rather than an exploitable hole. Removed regardless.
--
-- Ordinary data privileges (select/insert/update/delete) are untouched.

revoke truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Stop future tables inheriting the same over-grant.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated;
