import React, { useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Printer,
  FileText,
  Calendar,
  Clock,
  Truck,
  Building2,
  Package,
  ShieldCheck,
  MapPin,
  Phone,
  AlertCircle,
  QrCode,
  Share2,
  ImageIcon,
  Download,
  Loader2,
  KeyRound,
  DollarSign,
  User,
} from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import { Appointment } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatCurrencyBRL } from '../utils/formatters';

interface AppointmentReceiptModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}

export const AppointmentReceiptModal: React.FC<AppointmentReceiptModalProps> = ({
  isOpen,
  appointment,
  onClose,
}) => {
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedSummaryText, setCopiedSummaryText] = useState(false);

  if (!isOpen || !appointment) return null;

  // Split multiple invoices if comma/semicolon/newline separated
  const invoiceList = appointment.invoiceNumbers && appointment.invoiceNumbers.length > 0
    ? appointment.invoiceNumbers
    : appointment.invoiceNumber
        .split(/[,;\n\/]+/)
        .map(s => s.trim())
        .filter(Boolean);

  // Split multiple purchase orders if comma/semicolon/newline separated
  const purchaseOrderList = appointment.purchaseOrders && appointment.purchaseOrders.length > 0
    ? appointment.purchaseOrders
    : (appointment.purchaseOrder || '')
        .split(/[,;\n\/]+/)
        .map(s => s.trim())
        .filter(Boolean);

  const formattedDate = (() => {
    try {
      const d = new Date(appointment.scheduledDate + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return appointment.scheduledDate;
    }
  })();

  const shortDate = (() => {
    try {
      const d = new Date(appointment.scheduledDate + 'T00:00:00');
      return d.toLocaleDateString('pt-BR');
    } catch {
      return appointment.scheduledDate;
    }
  })();

  const handleCopyProtocol = () => {
    navigator.clipboard.writeText(appointment.protocol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter function to ensure buttons and interactive controls are completely excluded from the captured image
  const imageFilter = (node: HTMLElement | Node) => {
    if (node instanceof HTMLElement) {
      if (
        node.dataset.noImage === 'true' ||
        node.classList.contains('hide-in-receipt-image') ||
        node.tagName === 'BUTTON'
      ) {
        return false;
      }
    }
    return true;
  };

  // Copy Comprovante as PNG Image directly to Clipboard
  const handleCopyReceiptAsImage = async () => {
    if (!receiptCardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const node = receiptCardRef.current;
      const width = node.offsetWidth || 640;
      const height = node.scrollHeight;

      const blob = await toBlob(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2, // High resolution for sharp crisp text and barcodes
        filter: imageFilter,
        cacheBust: true,
        width: width,
        height: height,
        canvasWidth: width * 2,
        canvasHeight: height * 2,
      });

      if (!blob) {
        throw new Error('Não foi possível gerar a imagem.');
      }

      // Try copying directly to clipboard
      if (navigator.clipboard && window.ClipboardItem) {
        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        // Fallback: download the image if direct clipboard image write is not supported
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Comprovante-Agendamento-${appointment.protocol}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      }
    } catch (err: any) {
      console.warn('Erro ao copiar imagem diretamente para a área de transferência, iniciando download fallback:', err);
      try {
        const node = receiptCardRef.current;
        const width = node.offsetWidth || 640;
        const height = node.scrollHeight;
        const dataUrl = await toPng(node, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          filter: imageFilter,
          cacheBust: true,
          width: width,
          height: height,
          canvasWidth: width * 2,
          canvasHeight: height * 2,
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `Comprovante-Agendamento-${appointment.protocol}.png`;
        a.click();
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } catch (fallbackErr) {
        alert('Não foi possível capturar a imagem. Você pode utilizar a opção Imprimir / Salvar PDF.');
      }
    } finally {
      setIsCapturing(false);
    }
  };

  // Download PNG file directly
  const handleDownloadReceiptImage = async () => {
    if (!receiptCardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const node = receiptCardRef.current;
      const width = node.offsetWidth || 640;
      const height = node.scrollHeight;
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: imageFilter,
        cacheBust: true,
        width: width,
        height: height,
        canvasWidth: width * 2,
        canvasHeight: height * 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Comprovante-Agendamento-${appointment.protocol}.png`;
      a.click();
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyTextSummary = () => {
    const nfeKeysText = appointment.nfeAccessKeys && appointment.nfeAccessKeys.length > 0
      ? `\nChave(s) de Acesso NF-e (44 dígitos):\n${appointment.nfeAccessKeys.map((k, i) => `  #${i + 1}: ${k}`).join('\n')}`
      : appointment.nfeAccessKey ? `\nChave de Acesso NF-e: ${appointment.nfeAccessKey}` : '';

    const summary = `==============================
COMPROVANTE DE AGENDAMENTO DE CARGA
==============================
Protocolo: ${appointment.protocol}
Status: ${appointment.status}
Data Agendada: ${shortDate}
Janela de Horário: ${appointment.timeSlot}
Doca: ${appointment.dockId || 'A ser definida na portaria'}
Unidade de Destino: ${appointment.destinationBranchName || 'Matriz - Centro de Distribuição Principal'}
Endereço de Descarga: ${appointment.destinationBranchAddress || 'Não informado'}

--- DADOS DA CARGA & PEDIDO DE COMPRA ---
Pedido(s) de Compra (PO): ${purchaseOrderList.length > 0 ? purchaseOrderList.join(', ') : (appointment.purchaseOrder || 'Não informado')}
Notas Fiscais: ${invoiceList.length > 0 ? invoiceList.join(', ') : (appointment.invoiceNumber || 'Não informada')}
${appointment.invoiceTotalValue !== undefined && appointment.invoiceTotalValue !== null ? `Valor Total das NFs: ${formatCurrencyBRL(appointment.invoiceTotalValue)}\n` : ''}Fornecedor: ${appointment.supplierName}
CNPJ: ${appointment.supplierCnpj || 'Não informado'}${nfeKeysText}
Tipo de Carga: ${appointment.cargoType}
Volumes / Paletes: ${appointment.totalVolumes}
Peso Total: ${appointment.weightKg.toLocaleString('pt-BR')} KG

--- DADOS DO TRANSPORTE ---
Transportadora: ${appointment.carrierName || 'Própria'}
Motorista: ${appointment.driverName || 'Não informado'}${appointment.driverCpf ? ` (CPF: ${appointment.driverCpf})` : ''}
Telefone: ${appointment.driverPhone || 'Não informado'}
Placa do Veículo: ${appointment.vehiclePlate || 'Não informada'}
Tipo de Veículo: ${appointment.vehicleType}

--- OBSERVAÇÕES ---
${appointment.notes || 'Nenhuma observação informada.'}
==============================`;

    navigator.clipboard.writeText(summary);
    setCopiedSummaryText(true);
    setTimeout(() => setCopiedSummaryText(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-4 print:border-none print:shadow-none print:max-w-none print:w-full">
        
        {/* Modal Top Header (Hidden on Print and Captured Image) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden" data-no-image="true">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Comprovante de Agendamento</h2>
              <p className="text-xs text-slate-300">Documento oficial de confirmação de entrega e recebimento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar comprovante"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container for Modal View */}
        <div className="overflow-y-auto max-h-[78vh] p-2 sm:p-5 bg-slate-100/60 print:max-h-none print:overflow-visible print:p-0 print:bg-white">
          {/* Printable / Image Captured Card (Ref Container) */}
          <div
            ref={receiptCardRef}
            className="bg-white rounded-2xl p-5 sm:p-8 space-y-6 shadow-xs border border-slate-200/80 w-full print:border-none print:shadow-none print:p-4"
          >
            
            {/* Voucher Header Banner */}
            <div className="text-center space-y-3 border-b border-slate-200 pb-5">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200 print:w-10 print:h-10">
              <CheckCircle2 className="w-8 h-8 print:w-6 print:h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Agendamento Confirmado & Registrado
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Comprovante de Entrega de Mercadorias
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Apresente este protocolo na portaria e prevenção de perdas ao chegar ao endereço de entrega.
              </p>
            </div>
          </div>

          {/* Highlighted Protocol Box */}
          <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 border-2 border-blue-300/80 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-700 block">
                  Código de Protocolo do Agendamento
                </span>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-blue-800 tracking-tight">
                    {appointment.protocol}
                  </span>
                  <button
                    onClick={handleCopyProtocol}
                    data-no-image="true"
                    className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-200/60 rounded-xl transition-colors print:hidden cursor-pointer hide-in-receipt-image"
                    title="Copiar código do protocolo"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && (
                  <p data-no-image="true" className="text-xs text-emerald-600 font-bold hide-in-receipt-image">✓ Protocolo copiado!</p>
                )}
              </div>

              {/* Status and Dock Info Badge */}
              <div className="flex flex-col items-center sm:items-end gap-1.5">
                <StatusBadge status={appointment.status} size="lg" isPreApprovedContract={appointment.isPreApprovedContract} isWalkIn={appointment.isWalkIn} />
                <div className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  Doca: <strong className="text-blue-700">{appointment.dockId || 'A definir na chegada'}</strong>
                </div>
              </div>
            </div>

            {/* Visual Simulated Barcode Pattern */}
            <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <div className="flex items-center gap-1">
                <div className="h-6 flex items-center gap-0.5 opacity-60">
                  {[4, 2, 6, 1, 3, 5, 2, 4, 1, 7, 3, 2, 5, 1, 4, 2, 6, 3, 1, 5].map((w, i) => (
                    <span key={i} className="bg-slate-700 h-full inline-block" style={{ width: `${w}px` }} />
                  ))}
                </div>
                <span className="ml-2">{appointment.protocol}</span>
              </div>
              <span className="hidden sm:inline">AUTENTICAÇÃO SISTEMA AGENDA-DOCAS</span>
            </div>
          </div>

          {/* Key Information Sections Grid */}
          <div className="space-y-4 text-xs">
            
            {/* 1. Invoices, Purchase Order & Supplier */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>1. Pedido de Compra, Notas Fiscais & Fornecedor</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {appointment.purchaseOrder && (
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-indigo-900 block mb-1">
                      {purchaseOrderList.length > 1 ? `Pedidos de Compra (PO - ${purchaseOrderList.length}):` : 'Pedido de Compra (PO):'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {purchaseOrderList.length > 0 && purchaseOrderList[0] ? (
                        purchaseOrderList.map((po, idx) => (
                          <span
                            key={idx}
                            className="bg-white text-indigo-900 font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-300 text-xs shadow-2xs inline-block"
                          >
                            PO {po}
                          </span>
                        ))
                      ) : (
                        <span className="bg-white text-indigo-900 font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-300 text-xs shadow-2xs inline-block">
                          PO {appointment.purchaseOrder}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={`${appointment.purchaseOrder ? '' : 'sm:col-span-2'} bg-blue-50/70 border border-blue-200/80 rounded-xl p-3`}>
                  <span className="text-[11px] font-bold text-blue-900 block mb-1">
                    Número(s) da(s) Nota(s) Fiscal(is) (DANFE):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {invoiceList.length > 0 && invoiceList[0] ? (
                      invoiceList.map((nf, idx) => (
                        <span
                          key={idx}
                          className="bg-white text-blue-900 font-mono font-bold px-2.5 py-1 rounded-lg border border-blue-300 text-xs shadow-2xs"
                        >
                          NF {nf}
                        </span>
                      ))
                    ) : appointment.invoiceNumber ? (
                      <span className="font-mono font-bold text-slate-800">NF {appointment.invoiceNumber}</span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Pendente de emissão / Não informada</span>
                    )}
                  </div>
                  {appointment.invoiceSeries && (
                    <span className="text-[10px] text-blue-800 mt-1 block">Série: {appointment.invoiceSeries}</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 block">Razão Social / Fornecedor:</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{appointment.supplierName}</span>
                </div>

                <div>
                  <span className="text-slate-500 block">CNPJ / CPF do Fornecedor:</span>
                  <span className="font-mono font-semibold text-slate-800 text-xs block mt-0.5">
                    {appointment.supplierCnpj || 'Não informado'}
                  </span>
                </div>

                {appointment.invoiceTotalValue !== undefined && appointment.invoiceTotalValue !== null && (
                  <div className="sm:col-span-2 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-700" />
                      Valor Total das Notas Fiscais:
                    </span>
                    <span className="font-mono font-black text-emerald-900 text-sm">
                      {formatCurrencyBRL(appointment.invoiceTotalValue)}
                    </span>
                  </div>
                )}

                {/* Chaves de Acesso da NF-e */}
                {((appointment.nfeAccessKeys && appointment.nfeAccessKeys.length > 0) || appointment.nfeAccessKey) && (
                  <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        Chave(s) de Acesso da NF-e (44 dígitos):
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {appointment.nfeAccessKeys ? `${appointment.nfeAccessKeys.length} chave(s)` : '1 chave'}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(appointment.nfeAccessKeys && appointment.nfeAccessKeys.length > 0
                        ? appointment.nfeAccessKeys
                        : [appointment.nfeAccessKey!]
                      ).map((key, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-800 shadow-2xs"
                        >
                          <span className="truncate pr-2 select-all">
                            <span className="text-slate-400 mr-1.5">#{idx + 1}</span>
                            {key}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(key)}
                            data-no-image="true"
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-sans font-semibold shrink-0 cursor-pointer hide-in-receipt-image"
                            title="Copiar Chave"
                          >
                            Copiar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Scheduled Date & Time Window & Destination Branch */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>2. Local de Descarga & Janela Agendada</span>
              </div>

              {/* Destination Branch / Filial */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                    Unidade de Destino: <span className="text-blue-900 font-extrabold">{appointment.destinationBranchName || 'Matriz - Centro de Distribuição Principal'}</span>
                  </span>
                  {appointment.destinationBranchCnpj && (
                    <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                      CNPJ: {appointment.destinationBranchCnpj}
                    </span>
                  )}
                </div>
                {appointment.destinationBranchAddress && (
                  <p className="text-xs text-slate-700 ml-5 font-medium">
                    {appointment.destinationBranchAddress}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-0.5">
                  <span className="text-[11px] font-bold text-emerald-900 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Data Prevista de Entrega:
                  </span>
                  <span className="text-sm font-bold text-emerald-950 capitalize block">
                    {formattedDate}
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold block">
                    ({shortDate})
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-0.5">
                  <span className="text-[11px] font-bold text-indigo-900 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-700" /> Janela de Horário Reservada:
                  </span>
                  <span className="text-sm font-mono font-bold text-indigo-950 block">
                    {appointment.timeSlot}
                  </span>
                  <span className="text-[10px] text-indigo-700 block">
                    Tolerância máxima de chegada: 30 minutos
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Transport, Vehicle & Cargo Details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span>3. Transporte, Veículo & Dados da Carga</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Transportadora:</span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5">
                    {appointment.carrierName || 'Transportadora Própria'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Motorista Responsável:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {appointment.driverName || 'Apresentar na Portaria'}
                  </span>
                  {appointment.driverCpf && (
                    <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                      CPF: {appointment.driverCpf}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 block">Telefone / WhatsApp:</span>
                  <span className="font-semibold text-slate-800 font-mono block mt-0.5">
                    {appointment.driverPhone || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Placa do Veículo:</span>
                  <span className="font-mono font-bold text-blue-700 text-sm block mt-0.5">
                    {appointment.vehiclePlate || 'Não informada'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Tipo de Veículo:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {appointment.vehicleType}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Tipo de Carga:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {appointment.cargoType}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Quantidade de Volumes / Paletes:</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">
                    {appointment.totalVolumes} vol/paletes
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Peso Total Estimado:</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">
                    {appointment.weightKg.toLocaleString('pt-BR')} KG
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Doca Designada:</span>
                  <span className="font-bold text-emerald-700 block mt-0.5">
                    {appointment.dockId || 'Definição na Chegada'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Notes & Operational Instructions */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <span className="text-slate-700 font-bold block text-xs">
                Observações do Agendamento & Requisitos de Acesso:
              </span>
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                {appointment.notes || 'Nenhuma observação específica registrada para esta entrega.'}
              </p>
              <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-0.5 pt-1">
                <li>Obrigatório o uso de EPI completo (botina de segurança, colete refletivo) no pátio de descarregamento.</li>
                <li>Apresentar a DANFE impressa e o documento original do motorista com foto na portaria.</li>
                <li>Chegar com antecedência mínima de 15 minutos em relação à janela reservada.</li>
              </ul>
            </div>

          </div>

          {/* Timestamp footer on print */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400">
            <span>Emitido pelo Sistema Agenda-docas</span>
            <span>Data de Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

        </div>
      </div>

        {/* Modal Action Buttons Footer (Excluded from Print and Image Capture) */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden" data-no-image="true">
          
          {/* Left Actions: Copy Image & Download PNG */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleCopyReceiptAsImage}
              disabled={isCapturing}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 ${
                copiedImage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              } disabled:opacity-50`}
              title="Copia a imagem do comprovante diretamente para colar no WhatsApp, Teams ou E-mail"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Imagem...</span>
                </>
              ) : copiedImage ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>✓ Imagem Copiada!</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>Copiar como Imagem</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadReceiptImage}
              disabled={isCapturing}
              className="inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Baixar arquivo de imagem PNG do comprovante"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Baixar PNG</span>
            </button>

            <button
              onClick={handleCopyTextSummary}
              className="inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 text-xs font-medium px-2.5 py-2.5 rounded-xl transition-all cursor-pointer"
              title="Copiar texto simples"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px]">{copiedSummaryText ? 'Texto Copiado' : 'Texto'}</span>
            </button>
          </div>

          {/* Right Actions: Print & Close */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
