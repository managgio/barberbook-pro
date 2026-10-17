export type CommerceAppointmentInvoice = {
  id: string;
  appointmentId: string;
  number: string;
  issuedAt: string;
  currency: string;
  seller: {
    name: string;
    taxId: string;
    address: string;
    email: string | null;
    phone: string | null;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  service: {
    name: string;
    date: string;
    locationName: string;
    professionalName: string | null;
  };
  amounts: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
  };
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
  };
};
