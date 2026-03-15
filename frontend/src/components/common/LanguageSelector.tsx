import React from 'react';
import { Languages } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLanguageOption } from '@/lib/language';
import { useLanguage } from '@/hooks/useLanguage';
import { useI18n } from '@/hooks/useI18n';

type LanguageSelectorProps = {
  compact?: boolean;
  className?: string;
  persistForUser?: boolean;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className,
  persistForUser = false,
}) => {
  const { language, supportedLanguages, setLanguage } = useLanguage();
  const { t } = useI18n();
  if (supportedLanguages.length <= 1) return null;

  return (
    <div className={className}>
      <Select
        value={language}
        onValueChange={(value) => {
          setLanguage(value, { persistForUser });
        }}
      >
        <SelectTrigger className={compact ? 'h-8 text-xs' : 'h-10'}>
          <div className="flex items-center gap-2">
            <Languages className={compact ? 'h-3.5 w-3.5 text-primary' : 'h-4 w-4 text-primary'} />
            <SelectValue placeholder={t('language.selectorPlaceholder')} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {supportedLanguages.map((code) => {
            const option = getLanguageOption(code);
            return (
              <SelectItem key={code} value={code}>
                <span className="inline-flex items-center gap-2">
                  <span className="font-medium uppercase">{option.code}</span>
                  <span>{option.nativeLabel}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
