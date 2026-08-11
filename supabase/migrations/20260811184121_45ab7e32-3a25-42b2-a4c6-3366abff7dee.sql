CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  humidity_min INT NOT NULL, humidity_max INT NOT NULL,
  light_min INT NOT NULL, light_max INT NOT NULL,
  temp_min INT NOT NULL, temp_max INT NOT NULL,
  nutrients_min INT NOT NULL, nutrients_max INT NOT NULL,
  care_tip TEXT NOT NULL
);
GRANT SELECT ON public.species TO anon, authenticated;
GRANT ALL ON public.species TO service_role;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "species_public_read" ON public.species FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_id UUID NOT NULL REFERENCES public.species(id),
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Sala',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plants_user_idx ON public.plants(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plants_own" ON public.plants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  humidity NUMERIC(5,1) NOT NULL,
  light NUMERIC(5,1) NOT NULL,
  temperature NUMERIC(4,1) NOT NULL,
  nutrients NUMERIC(5,1) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX readings_plant_idx ON public.readings(plant_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readings TO authenticated;
GRANT ALL ON public.readings TO service_role;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readings_own" ON public.readings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'aviso',
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_idx ON public.alerts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_own" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.species (common_name, scientific_name, humidity_min, humidity_max, light_min, light_max, temp_min, temp_max, nutrients_min, nutrients_max, care_tip) VALUES
('Espada-de-são-jorge','Dracaena trifasciata',20,45,25,70,18,30,30,60,'Muito resistente; deixe o solo secar bem entre as regas.'),
('Jiboia','Epipremnum aureum',40,65,30,70,18,29,35,65,'Cresce rápido em meia-sombra; ótima para prateleiras.'),
('Costela-de-adão','Monstera deliciosa',45,70,40,75,18,29,40,70,'Gosta de luz indireta forte e umidade no ar.'),
('Zamioculca','Zamioculcas zamiifolia',20,40,20,65,18,30,25,55,'Quase indestrutível; odeia excesso de água.'),
('Pacová','Philodendron martianum',45,70,35,70,18,28,40,70,'Prefere ambiente úmido e luz filtrada.'),
('Antúrio','Anthurium andraeanum',55,75,35,65,18,28,45,75,'Flores duram semanas com umidade alta.'),
('Lírio-da-paz','Spathiphyllum wallisii',55,75,25,60,18,27,40,70,'Murcha para avisar que está com sede.'),
('Samambaia','Nephrolepis exaltata',60,80,30,60,16,26,40,70,'Ama banheiro úmido e luz suave.'),
('Peperômia','Peperomia obtusifolia',40,60,35,70,18,28,30,60,'Folhas suculentas guardam água.'),
('Maranta','Maranta leuconeura',55,75,25,55,18,27,40,70,'Fecha as folhas à noite; evite água dura.'),
('Calathea','Calathea orbifolia',60,80,25,55,18,27,45,75,'Exigente com umidade; use água filtrada.'),
('Ficus lyrata','Ficus lyrata',40,60,55,85,18,29,45,75,'Não gosta de mudanças de lugar.'),
('Ficus benjamina','Ficus benjamina',40,60,50,80,18,29,40,70,'Perde folhas com correntes de ar.'),
('Pau-d''água','Dracaena fragrans',35,55,30,65,18,29,35,65,'Tolera pouca luz; sensível a flúor na água.'),
('Dracena-marginata','Dracaena marginata',30,50,35,70,18,29,30,60,'Tronco fino e folhas finas avermelhadas.'),
('Palmeira-ráfis','Rhapis excelsa',45,65,30,65,18,28,40,70,'Palmeira de interior muito tolerante.'),
('Areca-bambu','Dypsis lutescens',45,70,50,80,18,29,45,75,'Umidifica o ar naturalmente.'),
('Chamaedorea','Chamaedorea elegans',45,65,25,55,18,27,35,65,'Palmeirinha clássica de sala.'),
('Cactus-mandacaru','Cereus jamacaru',10,25,75,100,15,35,20,45,'Sol pleno e solo bem drenado.'),
('Cacto-bola','Echinopsis oxygona',10,25,70,100,15,35,20,45,'Regue só quando o solo estiver seco.'),
('Suculenta-rosa-de-pedra','Echeveria elegans',10,30,70,100,15,30,20,45,'Sol direto deixa as cores mais bonitas.'),
('Suculenta-jade','Crassula ovata',15,30,65,95,15,30,25,50,'Considerada planta da sorte.'),
('Rabo-de-burro','Sedum morganianum',10,25,65,95,15,30,20,45,'Ideal para vasos suspensos.'),
('Aloe vera','Aloe barbadensis',15,30,65,95,15,32,25,50,'Gel das folhas acalma queimaduras.'),
('Babosa-tigre','Aloe variegata',15,30,65,95,15,32,25,50,'Folhas listradas e compactas.'),
('Orquídea-phalaenopsis','Phalaenopsis amabilis',50,70,35,65,18,28,35,65,'Regue por imersão semanal; substrato de casca.'),
('Orquídea-dendrobium','Dendrobium nobile',45,65,45,75,15,28,35,65,'Precisa de um período seco para florir.'),
('Bromélia','Guzmania lingulata',55,75,35,65,18,28,40,70,'Água vai no copo central da roseta.'),
('Violeta-africana','Saintpaulia ionantha',50,70,35,60,18,26,40,70,'Nunca molhe as folhas.'),
('Begônia-maculata','Begonia maculata',55,75,40,70,18,27,45,75,'Folhas de bolinhas prateadas.'),
('Kalanchoe','Kalanchoe blossfeldiana',20,40,60,90,15,30,30,60,'Florada longa com bastante luz.'),
('Gérbera','Gerbera jamesonii',45,65,65,95,15,28,50,80,'Precisa de sol e adubo frequente.'),
('Azaleia','Rhododendron simsii',50,70,45,75,12,24,45,75,'Gosta de solo ácido e fresco.'),
('Hortênsia','Hydrangea macrophylla',55,75,45,75,12,25,50,80,'Cor das flores muda com o pH do solo.'),
('Jasmim','Jasminum sambac',45,65,65,95,16,30,45,75,'Perfume forte no fim da tarde.'),
('Lavanda','Lavandula angustifolia',20,40,75,100,12,30,25,55,'Odeia solo encharcado; ama sol.'),
('Alecrim','Rosmarinus officinalis',20,40,75,100,12,32,25,55,'Poda leve mantém a planta cheia.'),
('Manjericão','Ocimum basilicum',45,70,65,95,18,30,45,80,'Colha as pontas para não florir cedo.'),
('Hortelã','Mentha spicata',55,80,50,80,15,28,45,75,'Cresce demais; plante em vaso próprio.'),
('Salsinha','Petroselinum crispum',50,70,55,85,12,26,45,75,'Corte as folhas de fora primeiro.'),
('Cebolinha','Allium schoenoprasum',50,70,60,90,12,28,45,75,'Rebrota rápido depois do corte.'),
('Tomilho','Thymus vulgaris',25,45,70,100,12,30,25,55,'Prefere solo pobre e seco.'),
('Orégano','Origanum vulgare',25,45,70,100,15,32,25,55,'Sabor mais forte quando falta água.'),
('Pimenta-dedo-de-moça','Capsicum baccatum',45,65,75,100,18,32,50,85,'Adubo rico em potássio na frutificação.'),
('Tomate-cereja','Solanum lycopersicum',50,70,75,100,18,30,55,90,'Precisa de tutor e sol pleno.'),
('Alface','Lactuca sativa',55,75,55,85,10,24,45,80,'Colheita em 45 dias; gosta de frio.'),
('Morango','Fragaria x ananassa',50,70,70,100,10,26,50,85,'Retire folhas velhas para arejar.'),
('Limoeiro-anão','Citrus x limon',40,60,75,100,15,32,50,85,'Vaso grande e adubação mensal.'),
('Café-arábica-de-vaso','Coffea arabica',50,70,40,70,18,28,45,75,'Luz indireta e umidade constante.'),
('Hera-inglesa','Hedera helix',45,65,35,70,10,24,35,65,'Ótima pendente; tóxica para pets.'),
('Clorofito','Chlorophytum comosum',40,60,40,75,15,28,35,65,'Produz mudinhas penduradas.'),
('Pilea','Pilea peperomioides',35,55,40,70,16,28,35,65,'Gire o vaso para crescer reta.');