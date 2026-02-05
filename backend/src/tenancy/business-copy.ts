import { TenantBusinessType } from './tenant-config.types';

const STAFF_SINGULAR_BY_TYPE: Record<TenantBusinessType, string> = {
  barbershop: 'barbero',
  hair_salon: 'estilista',
  aesthetics: 'profesional',
  nails: 'tecnica',
  physio: 'especialista',
  clinic: 'profesional',
  mixed_center: 'equipo',
};

export const resolveBusinessType = (value?: string | null): TenantBusinessType => {
  if (value && value in STAFF_SINGULAR_BY_TYPE) {
    return value as TenantBusinessType;
  }
  return 'barbershop';
};

export const resolveStaffSingular = (value?: string | null) => {
  const type = resolveBusinessType(value);
  return STAFF_SINGULAR_BY_TYPE[type];
};
