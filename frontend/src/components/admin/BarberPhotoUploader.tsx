import React, { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import defaultAvatar from '@/assets/img/default-image.webp';
import { useBusinessCopy } from '@/lib/businessCopy';

export type PhotoChangePayload = {
  previewUrl: string;
  dataUrl?: string;
  zoom?: number;
  remove?: boolean;
};

type Props = {
  value: string;
  onChange: (data: PhotoChangePayload) => void;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });

export const cropAndCompress = async (src: string, zoom: number) => {
  const image = await loadImage(src);
  const side = Math.min(image.width, image.height);
  const cropSize = side / zoom;
  const startX = (image.width - cropSize) / 2;
  const startY = (image.height - cropSize) / 2;
  const canvas = document.createElement('canvas');
  const OUTPUT_SIZE = 800;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el lienzo');

  ctx.drawImage(
    image,
    startX,
    startY,
    cropSize,
    cropSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('No se pudo procesar la imagen'));
        resolve(blob);
      },
      'image/webp',
      0.82
    );
  });
};

export const BarberPhotoUploader: React.FC<Props> = ({ value, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copy = useBusinessCopy();
  const [previewUrl, setPreviewUrl] = useState<string>(value);
  const [selectedDataUrl, setSelectedDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.05);

  useEffect(() => {
    setPreviewUrl(value);
  }, [value]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedDataUrl(dataUrl);
      setPreviewUrl(dataUrl);
      onChange({ previewUrl: dataUrl, dataUrl, zoom });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    handleFile(file || null);
  };

  const handleRemovePhoto = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setPreviewUrl(defaultAvatar);
    setSelectedDataUrl(null);
    onChange({ previewUrl: defaultAvatar, remove: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label>Foto {copy.staff.fromWithDefinite}</Label>
          <p className="text-sm text-muted-foreground">
            Recorte automático a cuadrado y compresión WebP antes de guardar la imagen.
          </p>
        </div>
        {previewUrl && (
          <div className="h-16 w-16 rounded-full border bg-muted/30 overflow-hidden">
            <img
              src={previewUrl}
              alt="Previsualización"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>

      <div
        className="rounded-lg border border-dashed bg-secondary/40 p-4 hover:border-primary/70 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-medium text-foreground">Arrastra o selecciona una imagen</p>
            <p className="text-sm text-muted-foreground">
              Recomendado 800x800px. Admite JPG/PNG/WebP. El archivo se optimiza antes de guardar.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar foto
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
      </div>

      {selectedDataUrl && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>Ajusta el recorte (zoom) antes de guardar</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-[220px_1fr] items-center">
            <div className="relative aspect-square overflow-hidden rounded-xl border">
              <img
                src={selectedDataUrl}
                alt="Recorte"
                className="h-full w-full object-cover transition-transform"
                style={{ transform: `scale(${zoom})` }}
              />
              <div className="pointer-events-none absolute inset-0 ring-2 ring-white/80" />
            </div>
            <div className="space-y-3">
              <Label className="text-sm text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Zoom / recorte centrado
              </Label>
              <Slider
                min={1}
                max={2}
                step={0.05}
                value={[zoom]}
                onValueChange={(vals) => {
                  const newZoom = vals[0];
                  setZoom(newZoom);
                  if (selectedDataUrl) {
                    onChange({ previewUrl: selectedDataUrl, dataUrl: selectedDataUrl, zoom: newZoom });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Se recorta al centro y se exporta a WebP 800x800 ({Math.round(zoom * 100)}% de zoom).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberPhotoUploader;
