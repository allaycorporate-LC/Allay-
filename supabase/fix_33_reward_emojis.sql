-- ══════════════════════════════════════════════════════════════════════════════
-- Fix #33: Emoji distinto por producto en la Store
--
-- buildStoreRewardCard() usa `r.emoji || cat.emoji` para generar la imagen
-- placeholder, pero las filas de "rewards" no tenían columna "emoji", por lo
-- que todos los productos de una misma categoría caían al emoji genérico de
-- la categoría (misma imagen para todos).
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.rewards add column if not exists emoji text;

update public.rewards set emoji = '☕'  where company_id is null and name = 'Taza';
update public.rewards set emoji = '🥤'  where company_id is null and name = 'Vaso Térmico';
update public.rewards set emoji = '💧'  where company_id is null and name = 'Botella Térmica';
update public.rewards set emoji = '🧉'  where company_id is null and name = 'Mate con bombilla';
update public.rewards set emoji = '🕯️' where company_id is null and name = 'Hornito con vela y esencias aromáticas';
update public.rewards set emoji = '☁️'  where company_id is null and name = 'Apoya muñecas nube';

update public.rewards set emoji = '🖊️' where company_id is null and name = 'Anotador con lapicera';
update public.rewards set emoji = '📓'  where company_id is null and name = 'Cuadernos';
update public.rewards set emoji = '🗒️' where company_id is null and name = 'Lapicero con post-it notes';

update public.rewards set emoji = '🔋'  where company_id is null and name = 'Kit Energía';
update public.rewards set emoji = '🧘'  where company_id is null and name = 'Kit Bienestar';
update public.rewards set emoji = '🏃'  where company_id is null and name = 'Kit Sport';

update public.rewards set emoji = '🌤️' where company_id is null and name = 'Medio día libre';
update public.rewards set emoji = '🏠'  where company_id is null and name = 'Un día extra de homeoffice en la semana';
update public.rewards set emoji = '🚪'  where company_id is null and name = 'Salida temprana el viernes';
update public.rewards set emoji = '🌴'  where company_id is null and name = 'Día libre completo';

update public.rewards set emoji = '🛒'  where company_id is null and name = 'Gift card MercadoLibre $10.000';
update public.rewards set emoji = '🛍️' where company_id is null and name = 'Gift card MercadoLibre $20.000';
update public.rewards set emoji = '🛒'  where company_id is null and name = 'Gift card Carrefour $10.000';
update public.rewards set emoji = '🎬'  where company_id is null and name = 'Netflix 1 mes';
update public.rewards set emoji = '🎧'  where company_id is null and name = 'Spotify Premium 1 mes';
update public.rewards set emoji = '🎁'  where company_id is null and name = 'Gift card multimarca';
