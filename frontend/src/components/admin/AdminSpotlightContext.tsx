import React, { createContext, useContext, useMemo, useState } from 'react';

type AdminSpotlightContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openSpotlight: () => void;
  closeSpotlight: () => void;
  toggleSpotlight: () => void;
};

const AdminSpotlightContext = createContext<AdminSpotlightContextValue | null>(null);

export const AdminSpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  const value = useMemo<AdminSpotlightContextValue>(
    () => ({
      open,
      setOpen,
      openSpotlight: () => setOpen(true),
      closeSpotlight: () => setOpen(false),
      toggleSpotlight: () => setOpen((prev) => !prev),
    }),
    [open],
  );

  return <AdminSpotlightContext.Provider value={value}>{children}</AdminSpotlightContext.Provider>;
};

export const useAdminSpotlight = () => {
  const context = useContext(AdminSpotlightContext);
  if (!context) {
    throw new Error('useAdminSpotlight must be used within AdminSpotlightProvider.');
  }
  return context;
};
