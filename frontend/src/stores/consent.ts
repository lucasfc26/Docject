import { create } from "zustand";

export type ConsentStatus = "pending" | "accepted" | "rejected";

const STORAGE_KEY = "projectfy-consent";

function readStored(): ConsentStatus {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    // localStorage indisponível
  }
  return "pending";
}

type ConsentStore = {
  status: ConsentStatus;
  accept: () => void;
  reject: () => void;
  reset: () => void;
};

export const useConsentStore = create<ConsentStore>((set) => ({
  status: readStored(),
  accept: () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      /* noop */
    }
    set({ status: "accepted" });
  },
  reject: () => {
    try {
      localStorage.setItem(STORAGE_KEY, "rejected");
    } catch {
      /* noop */
    }
    set({ status: "rejected" });
  },
  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    set({ status: "pending" });
  },
}));

/** Leitura síncrona do localStorage — usada fora de componentes React (ex: api.ts). */
export function getConsentStatus(): ConsentStatus {
  return readStored();
}
