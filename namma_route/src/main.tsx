import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import "./i18n/i18n";
import { UserProvider } from "./context/UserContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>
);
