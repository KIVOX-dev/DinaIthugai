import { Anek_Tamil } from "next/font/google";

/** The site uses Anek Tamil only (variable font: weights 100-800, Tamil + Latin glyphs). */
export const anekTamil = Anek_Tamil({ subsets: ["tamil", "latin"], variable: "--font-anek", display: "swap", weight: "variable" });

export const fontVars = anekTamil.variable;
