import React, { createContext, useContext, useState } from "react";

export type Currency = "USD" | "INR";

interface CurrencyState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (amount: number, fromCurrency?: Currency) => string;
  convert: (amount: number, fromCurrency?: Currency) => number;
}

const USD_TO_INR = 83.5;

const CurrencyContext = createContext<CurrencyState | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("INR");

  const convert = (amount: number, fromCurrency: Currency = "USD"): number => {
    if (fromCurrency === currency) return amount;
    if (fromCurrency === "USD" && currency === "INR") return amount * USD_TO_INR;
    if (fromCurrency === "INR" && currency === "USD") return amount / USD_TO_INR;
    return amount;
  };

  const format = (amount: number, fromCurrency: Currency = "USD"): string => {
    const converted = convert(amount, fromCurrency);
    if (currency === "INR") {
      if (converted >= 1000000000000) return `₹${(converted / 1000000000000).toFixed(2)} L Cr`;
      if (converted >= 10000000) return `₹${(converted / 10000000).toFixed(2)} Cr`;
      if (converted >= 100000) return `₹${(converted / 100000).toFixed(2)} L`;
      if (converted >= 1000) return `₹${converted.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
      return `₹${converted.toFixed(2)}`;
    }
    if (converted >= 1000000000000) return `$${(converted / 1000000000000).toFixed(2)}T`;
    if (converted >= 1000000000) return `$${(converted / 1000000000).toFixed(2)}B`;
    if (converted >= 1000000) return `$${(converted / 1000000).toFixed(2)}M`;
    return `$${converted.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
