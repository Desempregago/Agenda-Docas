import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Camera, Check, Upload, Trash2, Video, CheckCircle2, HardDrive } from 'lucide-react';
import { DiscrepancyReport, DiscrepancyType } from '../types';

interface DiscrepancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: DiscrepancyReport) => void;
  appointmentProtocol: string;
}

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  appointmentProtocol,
}) => {
  if (!isOpen) return null;

  const [selectedTypes, setSelectedTypes] = useState<DiscrepancyType[]>(['AVARIA_EMBALAGEM']);
  const [description, setDescription] = useState('');
  const [affectedVolumes, setAffectedVolumes] = useState(1);
  const [reportedBy, setReportedBy] = useState('Conferente de Recebimento - Turno 1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Live Camera state
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableTypes: { id: DiscrepancyType; label: string }[] = [
    { id: 'AVARIA_EMBALAGEM', label: 'Embalagem Avariada / Caixas Amassadas' },
    { id: 'FALTA', label: 'Falta de Volume (Contagem Menor que a NF)' },
    { id: 'EMBALAGEM_INCORRETA', label: 'Embalagem/Caixaria Diferente da NF' },
    { id: 'TEMPERATURA_FORA_PADRAO', label: 'Temperatura Fora do Padrão (Carga Fria)' },
    { id: 'VALIDADE_CURTA', label: 'Produto com validade abaixo do Shelf-Life' },
    { id: 'OUTROS', label: 'Outra Anomalia' },
  ];

  const toggleType = (type: DiscrepancyType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter(t => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // File Upload -> Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setPhotos(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Start Live WebCam
  const startLiveCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // câmera traseira no mobile
      });
      setStream(mediaStream);
      setIsLiveCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      setCameraError('Não foi possível acessar a câmera do dispositivo. Use o botão "Carregar Arquivo / Galeria" para anexar imagens.');
    }
  };

  // Capture photo from Live WebCam
  const capturePhotoFromLiveStream = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotos(prev => [...prev, dataUrl]);
    }
    stopLiveCamera();
  };

  // Stop Live WebCam
  const stopLiveCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsLiveCameraOpen(false);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    stopLiveCamera();

    const report: DiscrepancyReport = {
      id: `disc-${Date.now()}`,
      types: selectedTypes,
      description,
      affectedVolumes,
      reportedBy,
      reportedAt: new Date().toISOString(),
      photos: photos.length > 0 ? photos : [],
    };

    onSubmit(report);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-6">
        
        {/* Header */}
        <div className="bg-orange-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-700 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Registrar Divergência na Carga</h2>
              <p className="text-xs text-orange-100">
                Protocolo: <span className="font-mono font-bold text-white">{appointmentProtocol}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-orange-200 hover:text-white hover:bg-orange-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
          
          {/* Category Selectors */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Selecione o(s) Tipo(s) de Divergência Constatados:
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {availableTypes.map((item, tIdx) => {
                const checked = selectedTypes.includes(item.id);
                return (
                  <div
                    key={`disc-type-${item.id}-${tIdx}`}
                    onClick={() => toggleType(item.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      checked
                        ? 'bg-orange-50 border-orange-400 text-orange-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                        checked ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Volumes/Caixas Avariados</label>
              <input
                type="number"
                min="1"
                required
                value={affectedVolumes}
                onChange={e => setAffectedVolumes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Conferente</label>
              <input
                type="text"
                required
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observação Detalhada da Ocorrência <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Descreva exatamente o que foi constatado no momento do descarregamento na doca..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Photo Capture Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-orange-600" /> Registros Fotográficos do Conferente
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                {photos.length} foto(s) anexada(s)
              </span>
            </label>

            {/* Hidden Input for Native Camera / File Picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment" // Força abertura direta da câmera em dispositivos móveis
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Live Camera View Modal/Container */}
            {isLiveCameraOpen ? (
              <div className="p-3 bg-slate-900 rounded-xl space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-48 bg-black rounded-lg object-cover"
                />
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhotoFromLiveStream}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg"
                  >
                    <Camera className="w-4 h-4" /> Capturar Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-xl text-xs"
                  >
                    Fechar Câmera
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-3 rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-orange-600" />
                  <span>Tirar Foto / Anexar</span>
                </button>

                <button
                  type="button"
                  onClick={startLiveCamera}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  title="Abrir câmera ao vivo da webcam / celular"
                >
                  <Video className="w-4 h-4 text-orange-600" />
                  <span>Câmera ao Vivo</span>
                </button>
              </div>
            )}

            {cameraError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[11px] leading-tight">{cameraError}</p>
              </div>
            )}

            {/* Photos Preview Gallery */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-video bg-slate-100">
                    <img src={url} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 text-white rounded-md opacity-90 group-hover:opacity-100 hover:bg-rose-700 transition-opacity"
                      title="Remover foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Local Persistence Info Badge */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">Registro 100% On-Premise / Servidor Local</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-200/80 px-2 py-0.5 rounded-md">SQL Local</span>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                stopLiveCamera();
                onClose();
              }}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar com Divergência</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

