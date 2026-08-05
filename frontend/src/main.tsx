import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Managgio localiza su interfaz de forma nativa. Evitamos que traductores del
// navegador reescriban nodos controlados por React y rompan su reconciliacion.
document.documentElement.setAttribute("translate", "no");
document.documentElement.classList.add("notranslate");

void import("./lib/webVitals").then(({ startWebVitalsTracking }) => {
  startWebVitalsTracking();
});

createRoot(document.getElementById("root")!).render(<App />);
