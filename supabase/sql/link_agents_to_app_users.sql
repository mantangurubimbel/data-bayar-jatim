begin;

with mapping(agent_id, app_user_id) as (
  values
    (70001, 'eb490e17-027c-4d78-b8eb-ea2a72e0a536'::uuid),
    (70003, 'e3e32fcc-43a4-484e-9354-70c78ee606b3'::uuid),
    (70019, 'adc4ea1b-b896-4e1e-b748-6e605d9e39d7'::uuid),
    (70053, 'cc56cc1c-3848-471b-af6f-65679749b76e'::uuid),
    (70063, '1ed582fa-71e4-4979-9bf2-3db84bc63bff'::uuid),
    (70070, 'cac274c7-8447-4807-8420-c24c52778176'::uuid),
    (70072, 'd568e04f-453b-41c0-8c3d-75cfabb6eb81'::uuid),
    (70073, '7ace55f5-8282-410e-8819-840c10cd635e'::uuid),
    (70085, 'f55fcaa5-1cd7-4f84-b5ed-d6bf3cdfcab0'::uuid),
    (70087, '03af004e-8cc1-4ffe-82d1-7ff3478ccdc8'::uuid),
    (70112, 'ed6867f9-2869-43b7-9eb4-92b9684bf208'::uuid),
    (70122, 'da6c5866-9214-48b0-8bbf-652884ebb955'::uuid),
    (70123, 'faade3b6-fa59-43cb-b7f9-3715a466bd15'::uuid),
    (70131, '525db4fd-ca91-46b6-a8b3-2ae2959e0cf7'::uuid),
    (70142, 'c4b11aa5-b34b-41b0-8cd1-42ce9718e512'::uuid),
    (70166, '8d3065d3-7e62-45e4-869f-f7e35c144b06'::uuid),
    (70188, 'b941df33-4db3-4976-92d0-e503c1f92c69'::uuid),
    (70193, '0b4bfd9d-1a46-45f6-8a39-21ed5fc1af11'::uuid),
    (70215, '19bbd894-2f54-4960-a32b-bf661f91b646'::uuid),
    (70216, 'fefeb996-efb3-4320-915e-358e5ce72c9a'::uuid),
    (70231, 'fa20bf88-9db5-410e-8a7f-59776258e7df'::uuid),
    (70235, '7b68820b-4cd8-4e50-ae46-670b451baddd'::uuid),
    (70247, '624b041c-3d4e-4b69-9eff-5fb2b94c13f1'::uuid),
    (70250, '2ca21f6d-e47e-4d74-8ae4-e847aa8049bd'::uuid),
    (70251, 'be66f797-a38c-451e-9fbb-6c88a4521993'::uuid),
    (70260, 'b6115183-6153-40d0-ac36-9e7c4cfe1908'::uuid),
    (70273, '8e900195-b4d3-4c89-8c6d-d63627361927'::uuid),
    (70297, '77b1a941-5055-406c-884d-efb091c11a70'::uuid),
    (70298, 'a512eac2-a5bc-4bff-9d95-e7a57f21441b'::uuid),
    (70317, 'a0a58e57-8d42-41a7-bbc7-6068771480a6'::uuid),
    (70324, 'de2ccf9c-4fa5-4125-82ae-0ee72fbaef6c'::uuid),
    (70331, 'b342230f-1e22-48bd-b595-ab67aa0e195d'::uuid),
    (70337, 'aa6f9c02-5de8-45ec-84b7-43942e114b59'::uuid),
    (70349, '61362c87-89db-40f3-9c1d-2590170c5dcf'::uuid),
    (70350, '1b247c4b-8bcf-49ba-9836-5d6e18e2fcf2'::uuid),
    (70352, '116c6a2c-5b5a-49f2-9949-ea39a6a3c8ba'::uuid),
    (70358, '9cee4026-b3b7-4675-8066-d45ab89f27bf'::uuid),
    (70360, 'c734a5df-0bdc-4405-b5fe-7a45613abdac'::uuid),
    (70373, 'd928ed47-9540-485e-a9d4-f00694b763ea'::uuid),
    (70396, 'c31844a1-6cfa-4a84-a1bb-4e6d29d481c4'::uuid),
    (70399, 'ff0ac183-be51-46b2-b5b1-cb9031fec585'::uuid),
    (70410, 'a2751fde-3398-47ec-a214-97d16acace10'::uuid),
    (70418, '3ccf8903-2ffd-4dd5-a116-9ed752f93022'::uuid),
    (70428, 'e03ce85b-ac46-4382-9ea9-54f736ba89e2'::uuid),
    (70441, 'c18d7632-bc18-429b-b644-9969da95911f'::uuid),
    (70452, '639efb5b-37e6-4270-9b9f-06f044b91b8d'::uuid),
    (70453, '89c921a6-4682-429f-93ba-687488376e35'::uuid),
    (70459, '4bc6b332-d62f-454b-9f11-33eff45350fa'::uuid),
    (70464, '7fa7f7e9-db78-4ab9-8ef4-08aa2e581d19'::uuid),
    (70471, 'a3e9bf77-72af-402d-932c-d7efc7b2107c'::uuid),
    (70475, 'fdca8a22-7248-4d0c-a148-f88e0a56ed09'::uuid),
    (70490, '8aea31e8-8fb3-492b-bb48-ba5676dee8ee'::uuid),
    (70491, '55f36246-88a2-455f-ba0b-0810eeb50813'::uuid)
)
update public.t_agent as agent
set
  app_user_id = mapping.app_user_id,
  updated_at = now()
from mapping
where agent.agent_id = mapping.agent_id;

commit;

select agent_id, agent_name, app_user_id, is_active
from public.t_agent
where agent_id in (
  70001, 70003, 70019, 70053, 70063, 70070, 70072, 70073, 70085, 70087,
  70112, 70122, 70123, 70131, 70142, 70166, 70188, 70193, 70215, 70216,
  70231, 70235, 70247, 70250, 70251, 70260, 70273, 70297, 70298, 70317,
  70324, 70331, 70337, 70349, 70350, 70352, 70358, 70360, 70373, 70396,
  70399, 70410, 70418, 70428, 70441, 70452, 70453, 70459, 70464, 70471,
  70475, 70490, 70491
)
order by agent_id;
