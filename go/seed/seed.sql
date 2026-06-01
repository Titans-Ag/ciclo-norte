-- Seed Ciclo Norte MVP
-- Lojas
INSERT INTO loja (id, slug, nome, descricao, tipo, endereco, telefone) VALUES
('11111111-1111-1111-1111-111111111111', 'vendas', 'Vendas', 'Venda de ferramentas e equipamentos', 'vendas', 'Rua das Ferramentas, 100', '5511999999901'),
('22222222-2222-2222-2222-222222222222', 'locacao', 'Locação', 'Locação de ferramentas e equipamentos', 'locacao', 'Rua das Ferramentas, 200', '5511999999902');

-- Instância WhatsApp (1 instância compartilhada para demonstração)
INSERT INTO instancia_whatsapp (id, loja_id, nome, evolution_instance_name, numero_telefone, evolution_base_url, status) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'ciclo-norte-demo', 'ciclo-norte-demo', '+5511999999999', 'http://localhost:8080', 'connecting');

-- Atendentes (senha: 'senha123' — bcrypt hash)
INSERT INTO atendente (id, email, nome, senha_hash, role) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@ciclonorte.com', 'Administrador', '$2a$12$mLKsryZAqHD3KO.LZulNx.FGEyu.YAZP6ILDk/K4joYOOszcPtto.', 'admin'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'joao@ciclonorte.com', 'João Silva', '$2a$12$mLKsryZAqHD3KO.LZulNx.FGEyu.YAZP6ILDk/K4joYOOszcPtto.', 'atendente'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'maria@ciclonorte.com', 'Maria Souza', '$2a$12$mLKsryZAqHD3KO.LZulNx.FGEyu.YAZP6ILDk/K4joYOOszcPtto.', 'atendente'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'pedro@ciclonorte.com', 'Pedro Santos', '$2a$12$mLKsryZAqHD3KO.LZulNx.FGEyu.YAZP6ILDk/K4joYOOszcPtto.', 'atendente');

-- Alocações
INSERT INTO atendente_loja (atendente_id, loja_id, alocado_por) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Agentes Principais
INSERT INTO agente (id, loja_id, slug, nome, descricao, tipo, prompt_sistema, modelo, temperatura, max_tokens) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'principal', 'Assistente Vendas', 'Atende clientes da loja de vendas', 'principal', 'Você é o assistente de vendas da Ciclo Norte. Seja cordial e direto. Se o cliente perguntar sobre locação, use a tool transferir_setor. Se perguntar de preço ou estoque, consulte as tools disponíveis.', 'gpt-4o-mini', 0.7, 1500),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'principal', 'Assistente Locação', 'Atende clientes da loja de locação', 'principal', 'Você é o assistente de locação da Ciclo Norte. Seja cordial e direto. Se o cliente perguntar sobre preço de locação ou disponibilidade, consulte as tools. Se perguntar sobre compra/venda, use transferir_setor.', 'gpt-4o-mini', 0.7, 1500);

-- Agentes de Apoio
INSERT INTO agente (id, loja_id, slug, nome, descricao, tipo, prompt_sistema, modelo, temperatura, max_tokens, multimodal) VALUES
('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'consulta-preco', 'Consulta Preços', 'Consulta preços e estoque', 'apoio', 'Você recebe nome de produto e retorna preço e disponibilidade em JSON.', 'gpt-4o-mini', 0.0, 500, false),
('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'consulta-preco', 'Consulta Preços Locação', 'Consulta preços de locação', 'apoio', 'Você recebe nome de produto e retorna preço de locação diária e disponibilidade.', 'gpt-4o-mini', 0.0, 500, false);

-- Tools habilitadas
INSERT INTO agente_tool (agente_id, tool_slug, tool_config) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'consultar_preco', '{}'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'consultar_estoque', '{}'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'transferir_setor', '{}'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'consultar_preco', '{}'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'consultar_estoque', '{}'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'transferir_setor', '{}');

-- Produtos fictícios
INSERT INTO produtos (id, sku, nome, descricao, categoria, preco_venda, preco_locacao_dia) VALUES
(gen_random_uuid(), 'FUR001', 'Furadeira Bosch Professional 750W', 'Furadeira de impacto com mandril 1/2"', 'Ferramentas Elétricas', 450.00, 35.00),
(gen_random_uuid(), 'BET001', 'Betoneira 400L Trifásica', 'Betoneira robusta para obras', 'Máquinas de Construção', 3200.00, 180.00),
(gen_random_uuid(), 'AND001', 'Andaime Tubular 1m x 1,5m', 'Andaime tubular completo com rodízios', 'Equipamentos de Segurança', 580.00, 45.00),
(gen_random_uuid(), 'ESC001', 'Escada Extensível Alumínio 12 Degraus', 'Escada telescópica em alumínio', 'Equipamentos de Acesso', 320.00, 25.00),
(gen_random_uuid(), 'SERR001', 'Serra Circular Makita 7.1/4"', 'Serra circular profissional 1800W', 'Ferramentas Elétricas', 890.00, 65.00),
(gen_random_uuid(), 'LIX001', 'Lixadeira Orbital Bosch', 'Lixadeira orbital 240W', 'Ferramentas Elétricas', 280.00, 22.00),
(gen_random_uuid(), 'MART001', 'Martelo Demolidor 10kg', 'Martelo elétrico demolidor 1500W', 'Ferramentas Elétricas', 1200.00, 85.00),
(gen_random_uuid(), 'GER001', 'Gerador 5kVA Silenciado', 'Gerador a gasolina 5kVA', 'Equipamentos de Energia', 4500.00, 250.00),
(gen_random_uuid(), 'COMP001', 'Compressor de Ar 50L', 'Compressor 2HP 50 litros', 'Equipamentos Pneumáticos', 780.00, 55.00),
(gen_random_uuid(), 'ROS001', 'Rosqueadeira Elétrica 1/2" a 2"', 'Rosqueadeira elétrica com capacidade até 2"', 'Máquinas de Construção', 2100.00, 150.00),
(gen_random_uuid(), 'WAP001', 'WAP de Alta Pressão 2100psi', 'Lavadora de alta pressão industrial', 'Equipamentos de Limpeza', 1450.00, 95.00),
(gen_random_uuid(), 'SOP001', 'Soprador Térmico 2000W', 'Soprador de ar quente variável', 'Ferramentas Elétricas', 220.00, 18.00),
(gen_random_uuid(), 'NIV001', 'Nível Laser Autonivelante', 'Nível laser verde 360 graus', 'Equipamentos de Medição', 650.00, 48.00),
(gen_random_uuid(), 'FUR002', 'Furadeira Angular 550W', 'Furadeira angular compacta', 'Ferramentas Elétricas', 380.00, 28.00),
(gen_random_uuid(), 'DES001', 'Desentupidora Elétrica 20m', 'Máquina desentupidora com cabo 20m', 'Equipamentos de Limpeza', 1800.00, 120.00);

-- Estoque
INSERT INTO estoque (produto_id, quantidade, local, prazo_reposicao_dias)
SELECT id, (random() * 50 + 5)::int, 'Depósito Central', (random() * 10 + 2)::int
FROM produtos;
