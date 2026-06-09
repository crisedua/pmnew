-- ============================================================
-- FIX: areas_created_by_fkey -> "Key is not present in table profiles"
-- Causa: el usuario autenticado no tiene fila en `profiles`
-- (cuenta creada antes de que existiera el trigger de auto-perfil).
--
-- Solución robusta: trigger BEFORE INSERT en `areas` que crea el
-- perfil del creador desde auth.users si aún no existe. Además
-- rellena los perfiles faltantes ahora.
--
-- Ejecuta TODO este archivo en el SQL Editor del proyecto correcto.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_profile_for_area()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
  FROM auth.users u
  WHERE u.id = NEW.created_by
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_profile_before_area ON areas;
CREATE TRIGGER ensure_profile_before_area
  BEFORE INSERT ON areas
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_profile_for_area();

-- Backfill inmediato de perfiles faltantes
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
