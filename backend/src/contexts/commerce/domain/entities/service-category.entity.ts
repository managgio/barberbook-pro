export type ServiceCategoryServiceItemEntity = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  isArchived: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string;
    position: number;
  } | null;
};

export type ServiceCategoryEntity = {
  id: string;
  localId: string;
  name: string;
  description: string;
  position: number;
  services?: ServiceCategoryServiceItemEntity[];
};

