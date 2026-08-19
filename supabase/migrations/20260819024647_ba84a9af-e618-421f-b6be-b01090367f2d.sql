-- 1. DEVICES ---------------------------------------------------------------
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Sensor do Jardim',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inativo',
  ADD COLUMN IF NOT EXISTS require_key boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.devices ADD CONSTRAINT devices_status_check
    CHECK (status IN ('ativo','inativo','sem_sinal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS devices_set_updated_at ON public.devices;
CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS devices_user_idx ON public.devices (user_id);
CREATE INDEX IF NOT EXISTS devices_plant_idx ON public.devices (plant_id);

-- 2. READINGS --------------------------------------------------------------
ALTER TABLE public.readings
  ALTER COLUMN light DROP NOT NULL,
  ALTER COLUMN temperature DROP NOT NULL,
  ALTER COLUMN nutrients DROP NOT NULL;

ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS battery integer;

DO $$ BEGIN
  ALTER TABLE public.readings ADD CONSTRAINT readings_humidity_range
    CHECK (humidity >= 0 AND humidity <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS readings_plant_recorded_idx
  ON public.readings (plant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS readings_device_recorded_idx
  ON public.readings (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS readings_user_recorded_idx
  ON public.readings (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS alerts_user_open_idx
  ON public.alerts (user_id, resolved, created_at DESC);

-- 3. CONSENTIMENTO ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  cookie_consent boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_consents_select_own ON public.user_consents;
CREATE POLICY user_consents_select_own ON public.user_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_insert_own ON public.user_consents;
CREATE POLICY user_consents_insert_own ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_update_own ON public.user_consents;
CREATE POLICY user_consents_update_own ON public.user_consents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_consents_set_updated_at ON public.user_consents;
CREATE TRIGGER user_consents_set_updated_at BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. DISPOSITIVO INICIAL ----------------------------------------------------
INSERT INTO public.devices (user_id, device_id, name, plant_id, status)
SELECT p.user_id, 'SG-ESP32-001', 'Smart Garden ESP32 001', p.id, 'inativo'
FROM public.plants p
ORDER BY p.created_at
LIMIT 1
ON CONFLICT (device_id) DO NOTHING;

-- 5. REALTIME ---------------------------------------------------------------
ALTER TABLE public.readings REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.devices REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.readings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
