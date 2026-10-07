-- What the posting asks for (tools, methods, soft skills, languages), as written in it and checked in
-- the text. Shared by everyone; read once, when the offer is first judged.
alter table public.offers add column if not exists skills jsonb;
