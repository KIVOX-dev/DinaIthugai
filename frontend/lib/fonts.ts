import { Inter, Noto_Sans_Tamil, Noto_Serif_Tamil, Source_Serif_4 } from "next/font/google";

export const sansTa = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-sans-ta", display: "swap", weight: ["400", "500", "700", "800"] });
export const serifTa = Noto_Serif_Tamil({ subsets: ["tamil"], variable: "--font-serif-ta", display: "swap", weight: ["600", "700", "800"] });
export const sansEn = Inter({ subsets: ["latin"], variable: "--font-sans-en", display: "swap" });
export const serifEn = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-en", display: "swap", weight: ["400", "600", "700"] });

export const fontVars = `${sansTa.variable} ${serifTa.variable} ${sansEn.variable} ${serifEn.variable}`;
