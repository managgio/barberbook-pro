import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

void import("./lib/webVitals").then(({ startWebVitalsTracking }) => {
  startWebVitalsTracking();
});

createRoot(document.getElementById("root")!).render(<App />);
