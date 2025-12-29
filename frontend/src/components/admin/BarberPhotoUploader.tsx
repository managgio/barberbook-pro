import React, { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { uploadToImageKit } from '@/lib/imagekit';
import { useToast } from '@/hooks/use-toast';

type Props = {
  value: string;
  onChange: (url: string) => void;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });

const cropAndCompress = async (src: string, zoom: number) => {
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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(value);
  const [selectedDataUrl, setSelectedDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.05);
  const [isUploading, setIsUploading] = useState(false);

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
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    handleFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedDataUrl) {
      toast({
        title: 'Selecciona una imagen',
        description: 'Adjunta una foto antes de subirla.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const blob = await cropAndCompress(selectedDataUrl, zoom);
      const fileName = `barber-${Date.now()}.webp`;
      const url = await uploadToImageKit(blob, fileName);
      setPreviewUrl(url);
      setSelectedDataUrl(null);
      onChange(url);
      toast({
        title: 'Foto subida',
        description: 'Imagen optimizada y guardada en ImageKit.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      toast({
        title: 'Error al subir',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label>Foto del barbero</Label>
          <p className="text-sm text-muted-foreground">
            Recorte automático a cuadrado y compresión WebP antes de subir a ImageKit.
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
              Recomendado 800x800px. Admite JPG/PNG/WebP. El archivo se optimiza antes de subir.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Elegir archivo
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpload}
                disabled={isUploading || !selectedDataUrl}
              >
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar imagen
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
            <span>Ajusta el recorte (zoom) antes de subir</span>
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
                onValueChange={(vals) => setZoom(vals[0])}
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
