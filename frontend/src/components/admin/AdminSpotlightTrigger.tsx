import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminSpotlight } from '@/components/admin/AdminSpotlightContext';
import { cn } from '@/lib/utils';

type AdminSpotlightTriggerProps = {
  className?: string;
};

const AdminSpotlightTrigger: React.FC<AdminSpotlightTriggerProps> = ({ className }) => {
  const { openSpotlight } = useAdminSpotlight();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={openSpotlight}
      aria-label="Abrir spotlight"
      className={cn(
        'fixed bottom-[9.9rem] right-6 h-9 w-9 rounded-full bg-transparent shadow-none text-muted-foreground hover:text-foreground hover:bg-accent/70 z-50',
        className,
      )}
    >
      <Search className="h-4 w-4" />
    </Button>
  );
};

export default AdminSpotlightTrigger;
