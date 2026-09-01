export type AppointmentStatus =
  | 'PENDENTE'
  | 'CONFIRMADO'
  | 'EM_TRANSITO'
  | 'NO_PATIO'
  | 'AGUARDANDO_DESCARGA'
  | 'ENTREGUE_SEM_DIVERGENCIA'
  | 'ENTREGUE_COM_DIVERGENCIA'
  | 'NO_SHOW'
  | 'CANCELADO';

export type DiscrepancyType =
  | 'FALTA_VOLUME'
  | 'FALTA'
  | 'AVARIA_EMBALAGEM'
  | 'EMBALAGEM_INCORRETA'
  | 'CARGA_MISTURADA'
  | 'NOTA_FISCAL_INCORRETA'
  | 'TEMPERATURA_FORA_PADRAO'
  | 'VALIDADE_CURTA'
  | 'PRODUTO_VENCIDO'
  | 'OUTROS';

export interface DiscrepancyReport {
  id: string;
  types: DiscrepancyType[];
  description: string;
  affectedVolumes?: number;
  reportedBy: string;
  reportedAt: string;
  photos?: string[];
}

export interface RescheduleHistory {
  id: string;
  previousDate: string;
  previousSlot: string;
  newDate: string;
  newSlot: string;
  reason: string;
  requestedAt: string;
  requestedBy: string;
}

export interface DestinationBranch {
  id: string;
  name: string; // Ex: "Matriz - CD Central", "Filial Sul - Curitiba"
  code?: string; // Ex: "CD01", "FILIAL-02"
  cnpj?: string; // CNPJ da filial
  address?: string; // Ex: "Av. Industrial, 1000"
  neighborhood?: string; // Bairro
  city?: string; // Ex: "São Paulo"
  state?: string; // Ex: "SP"
  zipCode?: string; // CEP
  contactPhone?: string;
  contactEmail?: string;
  receptionInstructions?: string; // Instruções de acesso e portaria específicas
  active: boolean;
  isDefault?: boolean;
}

export interface Appointment {
  id: string;
  protocol: string; // Ex: AGD-2026-9821
  purchaseOrder: string; // Pedido de Compra (PO) - OBRIGATÓRIO
  purchaseOrders?: string[]; // Múltiplos Pedidos de Compra se houver mais de um
  invoiceNumber: string; // Número da Nota Fiscal (NF principal ou lista) - OPCIONAL
  invoiceNumbers?: string[]; // Múltiplas NFs se houver mais de uma
  invoiceSeries?: string;
  invoiceDueDate?: string; // Data de Validade / Vencimento do Boleto
  invoiceTotalValue?: number; // Valor Total das Notas Fiscais (R$)
  nfeAccessKeys?: string[]; // Lista de Chaves de Acesso da NF-e (44 dígitos cada, até 5 ou mais)
  nfeAccessKey?: string; // Chave de acesso individual (legado/compatibilidade)
  supplierName: string; // Nome do Fornecedor / Remetente
  supplierCnpj: string;
  carrierName: string; // Transportadora
  driverName?: string;
  driverCpf?: string; // CPF do Motorista
  driverPhone?: string;
  vehiclePlate?: string; // Placa do Veículo
  vehicleType: 'TRUCK_34' | 'TOCO' | 'VUC' | 'CARRETA' | 'VAN';
  cargoType: 'PALETIZADA' | 'BATIDA' | 'REFRIGERADA' | 'PERIGOSA' | 'FRACIONADA';
  weightKg: number;
  totalVolumes: number;
  
  // Destino / Filial de Entrega
  destinationBranchId?: string; // ID da filial / unidade de destino
  destinationBranchName?: string; // Nome da unidade (ex: "Matriz - CD Principal")
  destinationBranchAddress?: string; // Endereço do local de descarga
  destinationBranchCnpj?: string; // CNPJ da unidade recebedora
  
  scheduledDate: string; // YYYY-MM-DD
  timeSlot: string; // Ex: "08:00 - 09:30"
  dockId?: string; // ID da doca atribuída Ex: "DOCA-01"
  
  status: AppointmentStatus;
  notes?: string;
  isWalkIn?: boolean; // Indicação de Encaixe na Portaria / Veículo Não Agendado
  isPreApprovedContract?: boolean; // Indicação de Janela Pré-Aprovada / Contrato Fixo Recorrente
  
  createdAt: string;
  updatedAt: string;
  statusTimestamps?: Partial<Record<AppointmentStatus, string>>; // Timestamps de cada etapa (Confirmação, Portaria, Descarga, Conclusão, etc.)
  
  discrepancy?: DiscrepancyReport;
  rescheduleHistory: RescheduleHistory[];
  
  // Double Check da Prevenção de Perdas na Liberação de Descarga
  preventionDoubleChecked?: boolean; // Se passou pelo double check da Prevenção de Perdas
  preventionCheckedBy?: string; // Nome ou identificação do operador de prevenção
  preventionCheckedAt?: string; // Data/hora em que foi realizado o double check
}

export interface TimeSlotConfig {
  time: string;
  maxSuppliers: number; // Limite de fornecedores por janela de horário
}

export interface Dock {
  id: string;
  name: string; // Ex: "Doca 01 - Cargas Paletizadas"
  type: string;
  capacityPerSlot: number;
  isOperational: boolean;
  dailyLimit?: number; // Limite diário máximo (ex: 140, 40, 200, 50)
  limitUnit?: 'pallets' | 'volumes'; // Unidade do limite ('pallets' ou 'volumes')
}

export interface TimeSlot {
  time: string;
  maxSlots: number;
  availableSlots: number;
}

export type SystemUserRole = 'ADMIN' | 'OPERATOR' | 'SUPERVISOR' | 'SECURITY_GATE';

export interface SystemUser {
  id: string;
  name: string;
  username: string; // Login / E-mail / Matrícula
  email?: string;
  role: SystemUserRole;
  department: string;
  password?: string;
  pin?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RegisteredSupplier {
  cnpj: string;
  name: string;
  tradeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  lastLoginAt?: string;
  appointmentCount?: number;
}
