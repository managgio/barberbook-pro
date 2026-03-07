export const AI_TOOLS_READ_PORT = Symbol('AI_TOOLS_READ_PORT');

export type AiToolBarberRecord = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AiToolServiceRecord = {
  id: string;
  name: string;
  duration: number;
};

export type AiToolUserRecord = {
  id: string;
  name: string;
  email: string;
};

export interface AiToolsReadPort {
  findActiveBarbers(params: { localId: string }): Promise<Array<{ id: string; name: string }>>;
  findBarbersByIds(params: { localId: string; barberIds: string[] }): Promise<AiToolBarberRecord[]>;
  findBarbersByName(params: {
    localId: string;
    name: string;
    isActive?: boolean;
    take?: number;
  }): Promise<AiToolBarberRecord[]>;
  findBarberById(params: { localId: string; barberId: string }): Promise<AiToolBarberRecord | null>;
  findBarberNameById(params: { localId: string; barberId: string }): Promise<{ name: string } | null>;

  findServicesCatalog(params: { localId: string }): Promise<AiToolServiceRecord[]>;
  findServiceById(params: { localId: string; serviceId: string }): Promise<AiToolServiceRecord | null>;
  findServicesByName(params: {
    localId: string;
    name: string;
    take?: number;
  }): Promise<AiToolServiceRecord[]>;

  findClientByEmail(params: { brandId: string; email: string }): Promise<{ id: string; name: string } | null>;
  findClientByPhone(params: { brandId: string; phone: string }): Promise<{ id: string; name: string } | null>;
  findClientsByNameTerms(params: {
    brandId: string;
    terms: string[];
    take?: number;
  }): Promise<AiToolUserRecord[]>;
}
