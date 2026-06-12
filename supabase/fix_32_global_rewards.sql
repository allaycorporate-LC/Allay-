-- ══════════════════════════════════════════════════════════════════════════════
-- Fix #32: Catálogo global de la Store
--
-- Hasta ahora "rewards" era 100% por empresa: si una empresa no tenía filas
-- propias, el front mostraba productos de relleno (PH) marcados como
-- "Próximamente" y no canjeables.
--
-- Esta migración agrega un catálogo de 22 productos GLOBAL (company_id = NULL),
-- visible y canjeable por usuarios de TODAS las empresas (actuales y futuras),
-- sin necesidad de duplicar filas por empresa.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Columnas nuevas para las cards de la Store (foto real + badge opcional)
alter table public.rewards add column if not exists image_url text;
alter table public.rewards add column if not exists badge text;

-- 2) Permitir que rewards con company_id = NULL sean visibles para cualquier
--    usuario autenticado (catálogo global), además de las reglas existentes.
drop policy if exists "rewards_select" on public.rewards;
create policy "rewards_select" on public.rewards for select to authenticated
  using (
    company_id is null
    or company_id = public.my_company_id()
    or public.my_role() = 'superadmin'
  );

-- 3) Seed del catálogo global (22 productos)
insert into public.rewards (company_id, name, description, points_cost, category, badge, available) values
-- Para tu escritorio
(null, 'Taza',                                   'Una taza para acompañar tus mates, cafés o té.',                              80,   'merch', null,           true),
(null, 'Vaso Térmico',                           'Mantené tu bebida fría o caliente por horas.',                                150,  'merch', null,           true),
(null, 'Botella Térmica',                        'Hidratate todo el día, dentro y fuera de la oficina.',                        180,  'merch', null,           true),
(null, 'Mate con bombilla',                      'El combo infaltable para los materos del equipo.',                            200,  'merch', 'Muy elegido',  true),
(null, 'Hornito con vela y esencias aromáticas', 'Sumá un toque de aroma y relax a tu espacio.',                                220,  'merch', null,           true),
(null, 'Apoya muñecas nube',                     'Comodidad para tus largas jornadas frente a la compu.',                       120,  'merch', null,           true),
-- Productividad
(null, 'Anotador con lapicera',                  'Para anotar tus ideas, siempre a mano.',                                      100,  'office', null,          true),
(null, 'Cuadernos',                              'Set de cuadernos para organizar tu día a día.',                               90,   'office', null,          true),
(null, 'Lapicero con post-it notes',             'Todo lo que necesitás para tu escritorio en un solo lugar.',                  110,  'office', null,          true),
-- Kits de bienestar
(null, 'Kit Energía',                            'Taza, té, sahumerios y bolitas de sahumación para recargar energía.',         350,  'wellness', null,        true),
(null, 'Kit Bienestar',                          'Vela, journal y snacks para tu momento de relax.',                            380,  'wellness', 'Recomendado', true),
(null, 'Kit Sport',                              'Riñonera runner, snacks, vincha runner y bandas de resistencia para entrenar.', 420, 'wellness', null,       true),
-- Tiempo libre
(null, 'Medio día libre',                        'Tomate la tarde o la mañana, vos elegís.',                                    250,  'time_off', null,        true),
(null, 'Un día extra de homeoffice en la semana','Sumá un día de trabajo remoto extra a tu semana.',                            200,  'time_off', null,        true),
(null, 'Salida temprana el viernes',             'Arrancá el finde un poco antes.',                                             150,  'time_off', null,        true),
(null, 'Día libre completo',                     'Un día entero para vos, sin justificación.',                                  400,  'time_off', 'Más pedido', true),
-- Gift cards
(null, 'Gift card MercadoLibre $10.000',         'Para comprar lo que quieras en MercadoLibre.',                                800,  'gift_card', null,       true),
(null, 'Gift card MercadoLibre $20.000',         'El doble de opciones para vos.',                                              1600, 'gift_card', null,       true),
(null, 'Gift card Carrefour $10.000',            'Para tus compras de supermercado.',                                           800,  'gift_card', null,       true),
(null, 'Netflix 1 mes',                          'Un mes de series y películas.',                                               300,  'gift_card', null,       true),
(null, 'Spotify Premium 1 mes',                  'Un mes de música sin límites ni anuncios.',                                   250,  'gift_card', null,       true),
(null, 'Gift card multimarca',                   'Elegí entre múltiples marcas para tu canje.',                                 800,  'gift_card', 'Recomendado', true);
