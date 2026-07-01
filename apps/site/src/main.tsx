import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/onest";
import "@fontsource-variable/golos-text";
import "@fontsource-variable/unbounded";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
