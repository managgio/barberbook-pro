import { useRef, type ReactElement } from 'react';
import { Camera, Images } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useI18n } from '@/hooks/useI18n';

export default function PhotoSourcePicker({ children, onFiles, disabled = false, multiple = false, label }: {
  children: ReactElement; onFiles: (files: FileList) => void; disabled?: boolean; multiple?: boolean; label: string;
}) {
  const { t } = useI18n();
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const receive = (input: HTMLInputElement) => {
    if (!disabled && input.files?.length) onFiles(input.files);
    input.value = '';
  };
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild disabled={disabled}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => library.current?.click()}><Images className="mr-2 h-4 w-4" />{t('photos.library')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => camera.current?.click()}><Camera className="mr-2 h-4 w-4" />{t('photos.camera')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} hidden aria-label={label} disabled={disabled} onChange={(event) => receive(event.currentTarget)} />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={`${t('photos.camera')}: ${label}`} disabled={disabled} onChange={(event) => receive(event.currentTarget)} />
  </>;
}
