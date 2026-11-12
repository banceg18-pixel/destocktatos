import { describe, expect, it } from "vitest";
import { createAssistant, faqKnowledge, siteKnowledge, termsOf } from "@/lib/chat/assistant";

const store = { siteName: "Destocktatos", phone: "030 12345678", email: "contacts@destocktatos.com", hours: "Kundenservice Mo - So 10:00 - 20:00 Uhr", storeHours: "Geöffnet Montag bis Sonntag von 10:00 bis 20:00 Uhr", address: "Friedrichstraße 176-179, 10117 Berlin" };
const rayons = [
  { nom: "Kühlschrank", slug: "kuehlschrank", count: 80, sousCategories: ["Kombi", "Side by Side"] },
  { nom: "Waschmaschine", slug: "waschmaschine", count: 90, sousCategories: ["Frontlader", "Toplader"] },
  { nom: "Geschirrspüler", slug: "geschirrspueler", count: 50, sousCategories: ["Einbaugerät", "Kompakt"] },
  { nom: "Backofen", slug: "backofen", count: 20, sousCategories: ["Dampf"] },
];
// FAQ d'origine (encore en ligne) : ses anciennes réponses ne doivent pas passer avant celles du site.
const faq = [
  { title: "Zahlungen und Rechnungen", items: [{ question: "Welche Zahlungsmethoden werden akzeptiert?", answer: "Wir akzeptieren Kreditkarten (Visa, Mastercard), PayPal und Banküberweisungen." }] },
  { title: "Kundenkonto und Kundendienst", items: [{ question: "Bieten Sie einen Reparaturdienst an?", answer: "Ja, wir bieten einen Reparaturdienst an." }] },
];
const bot = createAssistant([...siteKnowledge(store, rayons, ["LG", "SAMSUNG", "BOSCH"]), ...faqKnowledge(faq)], { botName: "Destocktatos Assistent", welcome: "Guten Tag !" });
const ask = (q: string) => bot.reply(q);

describe("assistent der website", () => {
  it("führt die Varianten eines Worts auf einen Begriff zurück", () => {
    expect(termsOf("Wann liefern Sie?")).toContain("lieferung");
    expect(termsOf("Kann ich mit Karte bezahlen?")).toEqual(expect.arrayContaining(["zahlung", "karte"]));
    const t = termsOf("Wo bleibt meine Bestellung TAT-20261021-ABC123?");
    expect(t).toContain("verfolgung");
    expect(t).toContain("bestellung");
  });

  it.each([
    ["Wieviel kostet die Lieferung?", /Lieferung ist in ganz Deutschland kostenlos/],
    ["liefern Sie auch nach München?", /Lieferung ist in ganz Deutschland kostenlos/],
    ["Die Versandkosten, wie hoch sind die", /Lieferung ist in ganz Deutschland kostenlos/],
    ["Wie lange dauert die Lieferung?", /gemeinsam den Liefertermin/],
    ["wann bekomme ich die Ware geliefert", /rufen wir Sie an/],
    ["Kann ich mit Karte zahlen?", /ausschließlich per Banküberweisung/],
    ["Welche Zahlungsarten akzeptieren Sie?", /ausschließlich per Banküberweisung/],
    ["Ratenzahlung möglich?", /ausschließlich per Banküberweisung/],
    ["wo finde ich das IBAN", /Bankverbindung/],
    ["wo bleibt meine Bestellung", /Meine Bestellungen/],
    ["ich möchte ein Produkt zurücksenden", /14 Tage/],
    ["meine Waschmaschine ist kaputt", /Rückruf|Kontaktieren Sie uns/],
    ["Installieren Sie die Maschine? und nehmen das alte Gerät mit?", /Rücknahme Ihres Altgeräts/],
    ["Wie sind Ihre Öffnungszeiten", /Montag bis Sonntag/],
    ["wo ist euer Geschäft", /Berlin/],
    ["haben Sie amerikanische Kühlschränke?", /Kühlschrank/],
    ["ich suche eine Waschmaschine", /Waschmaschine/],
    ["gibt es einen Rabattcode", /Abverkaufspreise/],
    ["welche Marken verkaufen Sie", /LG, SAMSUNG, BOSCH/],
    ["Passwort vergessen", /Passwort vergessen/],
    ["Versand ist kostenlos?", /Lieferung ist in ganz Deutschland kostenlos/],
  ])("« %s »", (q, expected) => {
    const r = ask(q);
    expect(r.kind).toBe("answer");
    expect(r.text).toMatch(expected);
  });

  it("schlägt einen Rückruf vor, wenn es die Antwort nicht weiß", () => {
    for (const q of ["Was ist die Hauptstadt von Frankreich?", "Wie viele Dezibel hat der LG F94X71WHST beim Schleudern?", "blablabla"]) {
      const r = ask(q);
      expect(r.kind, q).toBe("unknown");
      expect(r.contactForm).toBe(true);
    }
  });

  it("nimmt die Kontaktdaten auf Anfrage, keine direkte Vermittlung", () => {
    expect(ask("ich möchte zurückgerufen werden").kind).toBe("callback");
    expect(ask("Ich möchte mit einem Berater sprechen").contactForm).toBe(true);
  });

  it("antwortet auf Höflichkeiten", () => {
    expect(ask("Guten Tag").text).toBe("Guten Tag !");
    expect(ask("vielen Dank").kind).toBe("smalltalk");
    expect(ask("sind Sie ein Roboter?").text).toMatch(/automatische Assistent/);
  });

  it("ein Defekt schlägt ebenfalls einen Rückruf vor", () => {
    expect(ask("mein Kühlschrank ist kaputt").contactForm).toBe(true);
  });
});

describe("FAQ von WordPress", () => {
  it("veraltete Antworten werden ersetzt, in WordPress umgeschriebene Antworten bleiben erhalten", async () => {
    const { refreshObsoleteFaq } = await import("@/lib/cms/faq");
    const reference = [{ title: "Zahlungen", items: [{ question: "Welche Zahlungsarten akzeptieren Sie?", answer: "Ausschließlich per Überweisung." }] }];
    const old = [{ title: "Zahlungen", items: [{ question: "Welche Zahlungsarten akzeptieren Sie?", answer: "Kreditkarten (Visa, Mastercard), PayPal und Überweisungen." }] }];
    expect(refreshObsoleteFaq(old, reference)[0].items[0].answer).toBe("Ausschließlich per Überweisung.");
    const edited = [{ title: "Zahlungen", items: [{ question: "Welche Zahlungsarten akzeptieren Sie?", answer: "Überweisung, bald weitere Zahlungsmittel." }] }];
    expect(refreshObsoleteFaq(edited, reference)[0].items[0].answer).toBe("Überweisung, bald weitere Zahlungsmittel.");
  });
});
