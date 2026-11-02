-- PRO VENTAS GC - Migración: Categorías en Catálogo de Productos
-- Agrega la columna 'category' a 'products' con valor predeterminado 'Otros'
-- e inicializa los registros existentes sin alterar sus demás campos.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros';

-- Actualizar productos existentes con categorías apropiadas de respaldo
UPDATE public.products
SET category = 'IA y Productividad'
WHERE (category IS NULL OR category = 'Otros')
  AND name ILIKE '%chatgpt%';

UPDATE public.products
SET category = 'Entretenimiento'
WHERE (category IS NULL OR category = 'Otros')
  AND (name ILIKE '%netflix%' OR name ILIKE '%disney%');

