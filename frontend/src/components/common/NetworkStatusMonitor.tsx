import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";

const NetworkStatusMonitor: React.FC = () => {
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const notifyOffline = () => {
      wasOfflineRef.current = true;
      toast({
        title: "Sin conexión",
        description: "No hay red disponible. Mostraremos datos en caché cuando existan.",
        variant: "destructive",
      });
    };

    const notifyOnline = () => {
      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;
      toast({
        title: "Conexión restablecida",
        description: "Tu conexión volvió. Ya puedes continuar normalmente.",
      });
    };

    if (!navigator.onLine) {
      notifyOffline();
    }

    window.addEventListener("offline", notifyOffline);
    window.addEventListener("online", notifyOnline);
    return () => {
      window.removeEventListener("offline", notifyOffline);
      window.removeEventListener("online", notifyOnline);
    };
  }, []);

  return null;
};

export default NetworkStatusMonitor;
