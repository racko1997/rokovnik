-- Supabase automatski izlaže tabele iz `public` šeme preko REST API-ja (anon ključ je javan).
-- Aplikacija pristupa bazi direktno kao vlasnik tabela (zaobilazi RLS), pa uključujemo
-- RLS bez ijedne politike: REST API ne vidi ništa, aplikacija radi normalno.
-- Na običnom Postgresu ovo nema nikakav efekat na rad aplikacije.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
