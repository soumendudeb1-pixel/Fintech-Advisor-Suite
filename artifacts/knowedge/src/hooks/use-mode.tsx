import React, { createContext, useContext, useState } from "react";

export type UserMode = "student" | "career" | "retiree";

interface ModeState {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
}

const ModeContext = createContext<ModeState | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<UserMode>("student");

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
