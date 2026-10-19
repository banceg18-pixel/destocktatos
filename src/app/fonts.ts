import { Archivo, Geist, Geist_Mono } from "next/font/google";

/**
 * Familles du design system, téléchargées au build et servies par le site (aucune requête vers
 * Google à l'exécution) :
 *  - Archivo (axe de largeur) : titres et marque, en version élargie ;
 *  - Geist : texte courant et interface ;
 *  - Geist Mono : vocabulaire « fiche technique » (références, dimensions, numéros de commande).
 * Sous-ensemble « latin » seulement (il couvre le français, œ, € et espaces fines compris) ;
 * la mono, secondaire, n'est pas préchargée pour laisser la bande passante aux titres et au texte.
 */
export const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
