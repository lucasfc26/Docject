import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import App from "./App";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.";
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => toast.error(errorMessage(error))
  }),
  mutationCache: new MutationCache({
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: (_data, _variables, _context, mutation) => {
      const message = mutation.meta?.successMessage;
      if (typeof message === "string") toast.success(message);
    }
  })
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3200} newestOnTop closeOnClick pauseOnHover theme="colored" />
    </QueryClientProvider>
  </React.StrictMode>
);
