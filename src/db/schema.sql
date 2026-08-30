-- ============================================================================
-- AGENDA-DOCAS - SISTEMA DE AGENDAMENTO DE DOCAS
-- SCHEMA DE BANCO DE DADOS SQL PARA SERVIDOR LOCAL (ON-PREMISE)
-- Compatível com: PostgreSQL (12+), MySQL (8+), MariaDB (10+), SQLite (3+)
-- ============================================================================

-- 1. TABELA DE USUÁRIOS, FORNECEDORES E OPERADORES
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(64) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    identificador VARCHAR(100) UNIQUE NOT NULL, -- CNPJ ou E-mail
    role VARCHAR(30) NOT NULL DEFAULT 'FORNECEDOR', -- 'FORNECEDOR', 'CONFERENTE', 'ADMIN_TI'
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'BLOQUEADO'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE DOCAS DE CARGA E DESCARGA
CREATE TABLE IF NOT EXISTS docas (
    id VARCHAR(64) PRIMARY KEY,
    numero INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'PALETIZADA', -- 'PALETIZADA', 'BATIDA', 'FRIGORIFICA', 'QUIMICOS', 'RAPIDA'
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'
    daily_limit INT NOT NULL DEFAULT 5000,
    limit_unit VARCHAR(30) NOT NULL DEFAULT 'volumes', -- 'volumes', 'pallets', 'kg', 'veiculos'
    capacidade_simultanea INT DEFAULT 1,
    observacoes TEXT
);

-- 3. TABELA DE JANELAS DE HORÁRIO
CREATE TABLE IF NOT EXISTS janelas_horario (
    id VARCHAR(64) PRIMARY KEY,
    horario_inicio VARCHAR(10) NOT NULL, -- Ex: '08:00'
    horario_fim VARCHAR(10) NOT NULL,    -- Ex: '09:00'
    label VARCHAR(30) NOT NULL,          -- Ex: '08:00 - 09:00'
    capacidade_padrao INT DEFAULT 3,
    ativo BOOLEAN DEFAULT TRUE
);

-- 4. TABELA PRINCIPAL DE AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
    id VARCHAR(64) PRIMARY KEY,
    protocolo VARCHAR(64) UNIQUE NOT NULL,
    fornecedor_nome VARCHAR(255) NOT NULL,
    fornecedor_cnpj VARCHAR(50) NOT NULL,
    transportadora_nome VARCHAR(255),
    motorista_nome VARCHAR(150),
    motorista_telefone VARCHAR(50),
    veiculo_placa VARCHAR(20),
    veiculo_tipo VARCHAR(50) NOT NULL DEFAULT 'TRUCK_34', -- 'VAN_UTILITARIO', 'TOCO_34', 'TRUCK_34', 'CARRETA_BAU', 'BITREM_RODOTREM'
    tipo_carga VARCHAR(50) NOT NULL DEFAULT 'PALETIZADA', -- 'PALETIZADA', 'BATIDA_DESPALETIZADA', 'FRIGORIFICA_PERECIVEL', 'CARGA_SECA_GERAL', 'QUIMICOS_CONTROLADOS'
    notas_fiscais TEXT NOT NULL, -- Números de NF (separados por vírgula ou JSON)
    nota_fiscal_serie VARCHAR(20) DEFAULT '1',
    data_vencimento_nf DATE,
    peso_kg DECIMAL(12, 2) DEFAULT 0.00,
    total_volumes INT NOT NULL DEFAULT 0,
    data_agendamento DATE NOT NULL,
    horario_janela VARCHAR(30) NOT NULL,
    doca_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'CONFIRMADO', 'NO_PATIO', 'AGUARDANDO_DESCARGA', 'EM_TRANSITO', 'ENTREGUE_SEM_DIVERGENCIA', 'ENTREGUE_COM_DIVERGENCIA', 'CANCELADO', 'NO_SHOW'
    observacoes TEXT,
    is_walk_in BOOLEAN DEFAULT FALSE,
    is_pre_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE HISTÓRICO DE REAGENDAMENTOS
CREATE TABLE IF NOT EXISTS historico_reagendamentos (
    id VARCHAR(64) PRIMARY KEY,
    agendamento_id VARCHAR(64) NOT NULL,
    data_anterior DATE NOT NULL,
    janela_anterior VARCHAR(30) NOT NULL,
    nova_data DATE NOT NULL,
    nova_janela VARCHAR(30) NOT NULL,
    motivo TEXT NOT NULL,
    solicitado_por VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
);

-- 6. TABELA DE RELATÓRIOS DE DIVERGÊNCIA
CREATE TABLE IF NOT EXISTS divergencias (
    id VARCHAR(64) PRIMARY KEY,
    agendamento_id VARCHAR(64) NOT NULL,
    protocolo VARCHAR(64) NOT NULL,
    tipos_divergencia TEXT NOT NULL, -- Ex: 'AVARIA_EMBALAGEM, FALTA'
    volumes_afetados INT DEFAULT 0,
    descricao TEXT NOT NULL,
    conferente_nome VARCHAR(150) NOT NULL,
    fotos_json TEXT, -- URLs ou Base64 das fotos
    status_resolucao VARCHAR(30) DEFAULT 'PENDENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
);

-- 7. TABELA DE CONFIGURAÇÕES LOCAIS DO SISTEMA
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    chave VARCHAR(100) PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DADOS INICIAIS / SEED PARA OPERAÇÃO LOCAL
-- ============================================================================

-- Inserir Docas Padrão
INSERT INTO docas (id, numero, nome, tipo, status, daily_limit, limit_unit) VALUES
('dock-1', 1, 'Doca 01 - Cargas Paletizadas', 'PALETIZADA', 'AVAILABLE', 5000, 'volumes'),
('dock-2', 2, 'Doca 02 - Carga Seca Geral / Batida', 'BATIDA_DESPALETIZADA', 'AVAILABLE', 3500, 'volumes'),
('dock-3', 3, 'Doca 03 - Químicos & Controlados', 'QUIMICOS_CONTROLADOS', 'AVAILABLE', 2000, 'volumes'),
('dock-4', 4, 'Doca 04 - Frigorífico & Perecíveis', 'FRIGORIFICA_PERECIVEL', 'AVAILABLE', 4000, 'volumes'),
('dock-5', 5, 'Doca 05 - Expressa / Utilitários', 'RAPIDA', 'AVAILABLE', 1500, 'volumes')
ON CONFLICT (id) DO NOTHING;

-- Inserir Usuários Iniciais
INSERT INTO usuarios (id, nome, identificador, role, status) VALUES
('usr-admin', 'Administração Geral TI', 'ti.admin@empresa.com.br', 'ADMIN_TI', 'ATIVO'),
('usr-conf1', 'Conferência de Portaria', 'portaria@empresa.com.br', 'CONFERENTE', 'ATIVO'),
('usr-supp-1', 'Eurofarma Laboratórios S.A.', '61.190.096/0001-92', 'FORNECEDOR', 'ATIVO'),
('usr-supp-2', 'Ambev Logística e Distribuição', '07.526.557/0001-00', 'FORNECEDOR', 'ATIVO'),
('usr-supp-3', 'Unilever Brasil Industrial Ltda', '61.068.276/0001-04', 'FORNECEDOR', 'ATIVO'),
('usr-supp-4', 'Natura Cosméticos S/A', '71.673.990/0001-77', 'FORNECEDOR', 'ATIVO'),
('usr-supp-5', 'Mondelēz Brasil Ltda', '02.721.272/0001-88', 'FORNECEDOR', 'ATIVO'),
('usr-supp-6', 'Moinho Dias Branco S.A.', '63.025.282/0001-44', 'FORNECEDOR', 'ATIVO'),
('usr-supp-7', 'Nestlé Brasil Ltda', '60.409.075/0001-52', 'FORNECEDOR', 'ATIVO')
ON CONFLICT (id) DO NOTHING;
