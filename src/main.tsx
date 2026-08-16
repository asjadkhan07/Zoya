import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Catch unhandled rejections from browser extensions (e.g., MetaMask, wallet injections)
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.message?.includes("MetaMask") ||
    event.reason?.message?.includes("ethereum") ||
    event.reason?.message?.includes("User rejected")
  ) {
    event.preventDefault();
    console.warn("Handled external extension rejection:", event.reason);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

