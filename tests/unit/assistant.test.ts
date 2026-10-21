import { describe, expect, it } from "vitest";
import { createAssistant, faqKnowledge, siteKnowledge, termsOf } from "@/lib/chat/assistant";

const store = { siteName: "Destocktatos", phone: "07 80 96 12 16", email: "contacts@destocktatos.com", hours: "Service disponible 10h - 20h, 7j/7", storeHours: "Ouvert du lundi au dimanche de 10h à 20h", address: "15 Rue Paul Langevin, 93270 Sevran" };
const rayons = [
  { nom: "réfrigérateur", slug: "refrigerateur", count: 80, sousCategories: ["combiné", "américain"] },
  { nom: "lave-linge", slug: "lave-linge", count: 90, sousCategories: ["hublot", "séchant"] },
  { nom: "lave-vaisselle", slug: "lave-vaisselle", count: 50, sousCategories: ["encastrable", "compact"] },
  { nom: "four", slug: "four", count: 20, sousCategories: ["vapeur"] },
];
// FAQ d'origine (encore en ligne) : ses anciennes réponses ne doivent pas passer avant celles du site.
const faq = [
  { title: "Paiements et Factures", items: [{ question: "Quels moyens de paiement acceptez-vous ?", answer: "Nous acceptons les cartes bancaires (Visa, Mastercard), PayPal et les virements bancaires." }] },
  { title: "Compte Client et Services", items: [{ question: "Proposez-vous un service de réparation ?", answer: "Oui, nous proposons un service de réparation." }] },
];
const bot = createAssistant([...siteKnowledge(store, rayons, ["LG", "SAMSUNG", "BOSCH"]), ...faqKnowledge(faq)], { botName: "Assistant Destocktatos", welcome: "Bonjour !" });
const ask = (q: string) => bot.reply(q);

describe("assistant du site", () => {
  it("ramène les variantes d'un mot à une notion", () => {
    expect(termsOf("Vous livrez à quelle date ?")).toContain("livraison");
    expect(termsOf("Je peux payer par CB ?")).toEqual(expect.arrayContaining(["paiement", "carte"]));
    expect(termsOf("Où en est ma commande TAT-20261021-ABC123 ?")).toEqual(["suivi", "commande"]);
  });

  it.each([
    ["Combien coûte la livraison ?", /offerte partout en France/],
    ["vous livrez en corse ?", /offerte partout en France/],
    ["Les frais de port sont de combien", /offerte partout en France/],
    ["Quel est le délai de livraison ?", /convenir ensemble du jour de livraison/],
    ["en combien de temps je suis livré", /convenir ensemble du jour de livraison/],
    ["Je peux payer par carte ?", /uniquement par virement/],
    ["Quels moyens de paiement acceptez-vous ?", /uniquement par virement/],
    ["paiement en plusieurs fois possible ?", /uniquement par virement/],
    ["où trouver le RIB", /coordonnées bancaires/],
    ["où en est ma commande", /Mes commandes/],
    ["je veux retourner un produit", /14 jours/],
    ["mon lave linge ne marche plus", /garantie légale/],
    ["Installez-vous la machine ? et reprise de l'ancienne ?", /reprise de votre ancien appareil/],
    ["Quels sont vos horaires", /lundi au dimanche/],
    ["c'est où votre magasin", /Sevran/],
    ["vous avez des frigos américains ?", /rayon réfrigérateur/],
    ["je cherche une machine a laver", /rayon lave-linge/],
    ["avez vous un code promo", /déstockage/],
    ["quelles marques vendez vous", /LG, SAMSUNG, BOSCH/],
    ["mot de passe oublié", /Mot de passe oublié/],
    ["livraisonn gratuite ?", /offerte partout en France/],
  ])("« %s »", (q, expected) => {
    const r = ask(q);
    expect(r.kind).toBe("answer");
    expect(r.text).toMatch(expected);
  });

  it("propose d'être recontacté quand il ne sait pas", () => {
    for (const q of ["Quelle est la capitale de la France ?", "Le LG F94X71WHST fait combien de décibels en essorage ?", "blablabla"]) {
      const r = ask(q);
      expect(r.kind, q).toBe("unknown");
      expect(r.contactForm).toBe(true);
    }
  });

  it("prend les coordonnées sur demande, pas de mise en relation directe", () => {
    expect(ask("je voudrais être rappelé").kind).toBe("callback");
    expect(ask("Je veux parler à un conseiller").contactForm).toBe(true);
  });

  it("répond aux politesses", () => {
    expect(ask("Bonjour").text).toBe("Bonjour !");
    expect(ask("merci beaucoup").kind).toBe("smalltalk");
    expect(ask("tu es un robot ?").text).toMatch(/assistant automatique/);
  });

  it("une panne propose aussi d'être recontacté", () => {
    expect(ask("mon frigo est en panne").contactForm).toBe(true);
  });
});
