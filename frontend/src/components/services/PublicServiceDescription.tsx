import { cn } from '@/lib/utils';

type PublicServiceDescriptionProps = {
  className?: string;
  description?: string | null;
  visible: boolean;
};

const PublicServiceDescription = ({
  className,
  description,
  visible,
}: PublicServiceDescriptionProps) => {
  const normalizedDescription = description?.trim();

  if (!visible || !normalizedDescription) return null;

  return (
    <p className={cn('text-muted-foreground', className)}>
      {normalizedDescription}
    </p>
  );
};

export default PublicServiceDescription;
