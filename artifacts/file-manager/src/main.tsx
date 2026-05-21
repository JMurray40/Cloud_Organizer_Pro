import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When the frontend is deployed separately from the API (e.g. Render Static Site
// + Render Web Service), set VITE_API_BASE_URL to the API service's origin.
// Unset (or same-origin) deployments work without this.
const apiBase = import.meta.env.VITE_API_BASE_URL;
if (apiBase) setBaseUrl(apiBase);

createRoot(document.getElementById("root")!).render(<App />);
