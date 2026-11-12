import MiniSearch, { type SearchResult } from "minisearch";
import { normalize } from "@/lib/text";
import { BIG_TICKET_OFFER } from "@/lib/offers";

/**
 * Assistent der Website: beantwortet häufige Fragen (Versand, Zahlung, Bestellung, Rückgabe,
 * Garantie, Kontakt, Kategorien des Sortiments, dann die in WordPress gepflegte FAQ). Alles läuft
 * auf dem Server der Website, ohne externen Dienst: die Frage wird auf ihre sinntragenden Wörter
 * zurückgeführt (Umlaute, Plural und Synonyme werden verstanden) und mit den bekannten Antworten
 * verglichen, Tippfehler werden toleriert. Ohne verlässliche Antwort weist der Assistent darauf hin
 * und bietet dem Kunden an, seine Kontaktdaten für einen Rückruf des Teams zu hinterlassen.
 */

/* ------------------------------------------------------------------------------- Typen */

export type AssistantReplyKind = "answer" | "smalltalk" | "callback" | "unknown";

export interface AssistantLink {
  label: string;
  href: string;
}

export interface KnowledgeEntry {
  id: string;
  /** Formulierte Frage (tous les mots sont indexés). */
  question: string;
  /** Mots et expressions qui mènent à cette réponse (synonymes, formulations courantes). */
  keywords: string;
  answer: string;
  links?: AssistantLink[];
  /** Le formulaire « être recontacté » est proposé avec la réponse. */
  contact?: boolean;
  source?: "site" | "faq" | "rayon";
}

export interface AssistantReply {
  kind: AssistantReplyKind;
  text: string;
  links?: AssistantLink[];
  suggestions?: string[];
  /** Formulaire « être recontacté » à afficher. */
  contactForm?: boolean;
}

/* ------------------------------------------------------------------------------- Mots de la question */

const STOP_WORDS = new Set(
  (
    "der die das den dem des ein eine einen einem eines und oder aber ist sind war waren ich du er sie es wir ihr sie " +
    "mich mir dich dir ihn ihm uns euch a am an auf aus bei mit nach von vor zu zum zur im in für über unter durch um " +
    "bitte danke Hallo hallo tschüss guter gut hei hey ciao wird werden kann kann man darf sollte möchtet würde " +
    "hat haben hatte hab bin bist seid sind war wie was wann wo welche welcher welches wer warum wieso weshalb " +
    "viel viele sehr auch noch schon mal nur ab bis ca etwa denn doch ja nein vielleicht sondern also " +
    "gerne möglich möglichkeit ungefähr genau gibt es gibt muss müssen brauche bräuchte suche finden ihre ihrepter euer euerer meinen viele vielen tag tagen zeit mehrere"
  ).split(" "),
);

/** Notions clés : les variantes d'un même mot (liefern, liefert, Lieferung…) deviennent un seul terme. */
const CONCEPTS: [RegExp, string][] = [
  [/^(liefer|versand|zustell|sendung|paket|transport|spedition|geliefert|liefern)/, "lieferung"],
  [/^(dauer|frist|zeitraum|termin|wann)$/, "dauer"],
  [/^(zahl|bezahl|zahlung|bezah|pay|abrechn|begleich|einmalig|dauerauftrag|ratenzahlung|raten)/, "zahlung"],
  [/^(ueberweis|überweis|bankueber|banküber|ueberweisung|transfer|rib|iban|bic|bank|bankverbind|sepa)$/, "ueberweisung"],
  [/^(karte|kreditkarte|debit|visa|mastercard|amex|paypal|scheck|bar|bargeld|kredit|raten|teilzahl|monatsraten|abschnitt)$/, "karte"],
  [/^(rechnung|beleg|quittung|angebot|kostenvoranschlag|devis)/, "rechnung"],
  [/^(bestell|order|kauf|shoppen)/, "bestellung"],
  [/^(verfolg|verfol|stand|status|tracking|sendeverfolg|paketscan)$/, "verfolgung"],
  [/^(stornier|abbruch|abbrechen|loesch|lösch|aender|änder|umbuch|korrigier)/, "stornierung"],
  [/^(rueckgabe|rückgabe|retoure|zurueck|rück|widerruf|erstatt|umsatz|rückerstatt|tauschen|umtausch)$/, "rueckgabe"],
  [/^(garanti|gewaehr|gewähr|sav|defekt|reparatur|reparier|fehler|bruch|funktionier|kaputt)/, "garantie"],
  [/^(install|montag|anschluss|aufstell|inbetrieb|anbau|montier)/, "installation"],
  [/^(ruecknahme|rücknahme|altgeraet|altgerät|recycl|entsorgung|mitnahme|abbau|rauswurf)$/, "ruecknahme"],
  [/^(etage|stockwerk|treppe|treppen|aufzug|fahrstuhl)$/, "etage"],
  [/^(kontakt|erreichen|telefon|anruf|nummer|telefonier|mail|e-mail|email|anfrage|schreiben)/, "kontakt"],
  [/^(oeffnungs|offnungs|zeiten|zeit|geschlossen|feiertag|sonntag|samstag|montag|uhr)/, "oeffnungszeit"],
  [/^(adresse|standort|laden|geschaef|geschaft|geschäft|showroom|filiale|lokal)$/, "adresse"],
  [/^(promo|aktion|sale|rabbat|rabatt|gutschein|coupon|destock|discount|reduziert)$/, "promo"],
  [/^(preis|kosten|gebuehr|gebühr|teuer|preiswert)$/, "preis"],
  [/^(konto|registrier|anmeld|einloggen|login|passwort|kennwort)$/, "konto"],
  [/^(lager|bestand|verfuegbar|verfügbar|lieferbar|ausverkauft|wiederauffuell|nachkauf|leer)$/, "bestand"],
  [/^(kostenlos|gratis|umsonst|gebuehrenfrei|gebührenfrei|offert|bezahlbar)$/, "kostenlos"],
  [/^(marke|hersteller|fabrikant)$/, "marke"],
  [/^(kuehl|kuhl|frigo|komb.i|sideby-?side|weinkuehl|weinkuhl|kuehlschr.+|kuhlschr.+)$/, "kuehlschrank"],
  [/^(gefriertief|tiefkuehl|tiefkühl|gefriertruhe|gefrierschrank)$/, "gefriergeraet"],
  [/^(klima|klimaanlage|ventilator)$/, "klimageraet"],
  [/^(fernseh|tv|television|fernseher|bildschirm)$/, "fernseher"],
  [/^(staubsaug|saugroboter|besen)$/, "staubsauger"],
  [/^(herd|e herd|kochfeld|ceran)$/, "herd"],
];
const CONCEPT_NAMES = new Set(CONCEPTS.map(([, c]) => c));
/** Notions de service : quand la question en contient une, elle ne porte pas sur un rayon du catalogue. */
const SERVICE_CONCEPTS = new Set(["lieferung", "dauer", "zahlung", "ueberweisung", "karte", "rechnung", "bestellung", "verfolgung", "stornierung", "rueckgabe", "garantie", "installation", "ruecknahme", "etage", "kontakt", "oeffnungszeit", "adresse", "konto", "kostenlos", "preis", "bestand"]);
/** Mots trop courants pour suffire à eux seuls à choisir une réponse. */
const WEAK_WORDS = new Set(["deutschland", "seite", "produkt", "produkte", "geraet", "gerät", "artikel", "kunde", "service", "frage", "info", "information", "wissen", "haben"]);

/** Terme utile d'un mot (ou null pour un mot vide) : sans accents, notion clé, sans pluriel. */
export function termOf(word: string): string | null {
  const t = normalize(word).replace(/[^a-z0-9]/g, "");
  // Mots vides, nombres et références (numéro de commande…) : sans intérêt pour choisir une réponse.
  if (!t || STOP_WORDS.has(t) || /\d/.test(t)) return null;
  for (const [re, concept] of CONCEPTS) if (re.test(t)) return concept;
  return t.length > 4 ? t.replace(/(?<=[a-z])[sx]$/, "") : t;
}

/** Expressions ramenées à un mot clé avant découpage (« wo bleibt » → suivi, « geht nicht mehr » → panne…). */
const PHRASES: [RegExp, string][] = [
  [/\b(wie steht es um|wo bleibt|nicht (noch )?angekommen|nicht geliefert|nicht geliefert worden)\b/g, " verfolgung "],
  [/\bgeht (nicht mehr|nicht)\b/g, " defekt garantisfrage "],
  [/\bfunktioniert (nicht mehr|nicht)\b/g, " defekt garantisfrage "],
  [/\bwie lange (dauert|dauert es|braucht|dauert die lieferung)\b/g, " dauer "],
  [/\bwieviel kostet\b/g, " preis lieferung "],
  [/\bwasdlords\b/g, " waschmaschine "],
  [/\bwaschmaschine\b/g, " waschmaschine "],
  [/\bversandkosten\b/g, " lieferung preis "],
  [/\brabattcode\b/g, " promo "],
];

const tokenize = (text: string) => {
  let t = normalize(text).replace(/[^a-z0-9]+/g, " ");
  for (const [re, by] of PHRASES) t = t.replace(re, by);
  return t.split(" ").filter(Boolean);
};

/** Termes utiles d'une question, sans doublons. */
export function termsOf(text: string): string[] {
  return [...new Set(tokenize(text).map(termOf).filter((t): t is string => !!t))];
}

const weightOf = (term: string) => (CONCEPT_NAMES.has(term) ? 2 : WEAK_WORDS.has(term) ? 0.5 : 1);

/* ------------------------------------------------------------------------------- Petites phrases */

export const STARTERS = [
  "Versandkosten & Lieferung",
  "Wie bezahle ich meine Bestellung?",
  "Bestellung verfolgen",
  "Artikel zurücksenden",
  "Garantie & Kundendienst",
  "Öffnungszeiten und Adresse",
];

const SMALLTALK: { re: RegExp; reply: (ctx: { botName: string; welcome: string }) => AssistantReply }[] = [
  {
    re: /^(hallo|hi|hey|guten tag|guten morgen|guten abend|servus|moin|gruezi|gruzi)( (zusammen|ihnen|du))?$/,
    reply: ({ welcome }) => ({ kind: "smalltalk", text: welcome, suggestions: STARTERS }),
  },
  {
    re: /^(ok |super |perfekt |top |prima )?(danke|dankeschoen|dankeschon|vielen dank|besten dank|herzlichen dank|danke sehr)( (ihnen|dir|schoen))?$/,
    reply: () => ({ kind: "smalltalk", text: "Gern geschehen! Haben Sie noch eine andere Frage?" }),
  },
  {
    re: /^(ok|okay|in ordnung|verstanden|einverstanden|prima|super|top|geht klar|alles klar)$/,
    reply: () => ({ kind: "smalltalk", text: "Sehr gut. Zögern Sie nicht, wenn Sie noch eine Frage haben." }),
  },
  {
    re: /^(auf wiedersehen|tschus|tschuss|tschüss|bis bald|bis dann|schonen tag|gute nacht|bis spater|bis später)( danke)?$/,
    reply: () => ({ kind: "smalltalk", text: "Danke für Ihren Besuch und bis bald bei Destocktatos!" }),
  },
  {
    re: /(wer bist du|sind sie ein robot|ist das ein bot|bin ich mit einem menschen verbunden|kunstliche intelligenz|chatbot|ki mit|sind sie ein roboter|ein roboter|bist du ein roboter)/,
    reply: ({ botName }) => ({
      kind: "smalltalk",
      text: `Ich bin ${botName}, der automatische Assistent der Seite. Ich beantworte häufige Fragen: Versand, Zahlung, Bestellungen, Rückgabe, Garantie… Wenn ich nicht weiter weiß, leite ich Ihre Anfrage an das Team weiter, das sich bei Ihnen meldet.`,
      suggestions: STARTERS,
    }),
  },
  {
    re: /(rueckruf|rufen sie mich|kontaktiert mich|mit jemandem sprechen|einen berater|eine beraterin|einen menschen|eine echte person|einen verkaeufer|einen verkäufer|einen mitarbeiter|zuruckgerufen|rufen sie mich zurueck)/,
    reply: () => ({
      kind: "callback",
      text: "Gerne. Hinterlassen Sie Ihre Kontaktdaten und Ihre Frage: Unser Team meldet sich schnell bei Ihnen.",
      contactForm: true,
    }),
  },
];

/* ------------------------------------------------------------------------------- Connaissance du site */

export interface StoreInfo {
  siteName: string;
  phone: string;
  email: string;
  hours: string;
  storeHours: string;
  address: string;
}

export interface Rayon {
  nom: string;
  slug: string;
  /** Produits disponibles dans le rayon. */
  count: number;
  sousCategories: string[];
}

/** Synonymes (allemands) des rayons, pour reconnaître « Kühlschrank », « Waschmaschine »… */
const RAYON_WORDS: Record<string, string> = {
  kuehlschrank: "kühlschrank kühlschränke kombi side by side american kühlvitrine weinkühlschrank",
  gefriergeraet: "gefrierschrank gefriertruhe gefriergerät gefrierkombi",
  waschmaschine: "waschmaschine waschautomaten waschvollautomaten waschfrontlader waschtoplader frontlader toplader",
  trockner: "trockner wäschetrockner wärmepumpentrockner kondensationstrockner",
  geschirrspueler: "geschirrspüler geschirrspülmaschine spülmaschine",
  herd: "herd gas herd gasherd elektroherd backofen kochfeld ceranfeld",
  backofen: "backofen einbaubackofen pyrolyse",
  kochfeld: "kochfeld glut gentherm glaskeramik",
  mikrowelle: "mikrowelle mikrowellen gerät mikrowellenofen",
  dunstabzugshaube: "dunstabzugshaube abzugshaube kopffreie haube",
  staubsauger: "staubsauger roboterstaubsauger besenstaubsauger",
  klimageraet: "klimagerät klimaanlage klimageräte",
  kuechenmaschine: "küchenmaschine kenwood köchenroboter küchenroboter mixer blender",
  fernseher: "fernseher fernseher tv gerät led oled",
  weitere: "kleingeräte fritteuse airfryer dampfbuegeleisen dampfglatter toaster",
};

type Draft = Omit<KnowledgeEntry, "source"> & { source?: KnowledgeEntry["source"] };

export function siteKnowledge(store: StoreInfo, rayons: Rayon[], brands: string[]): KnowledgeEntry[] {
  const contactLine = [store.phone && `telefonisch unter ${store.phone}`, store.email && `per E-Mail an ${store.email}`].filter(Boolean).join(" oder ");
  const entries: Draft[] = [
    {
      id: "lieferung",
      question: "Wie viel kostet die Lieferung?",
      keywords: "versand lieferung versandkosten lieferkosten kosten kostenlos gratis frei haus zustellung deutschland deutschlandweit lieferzeit",
      answer:
        "Die Lieferung ist in ganz Deutschland kostenlos, egal welche Option Sie wählen: bis zur Bordsteinkante, in den Raum Ihrer Wahl oder mit Installation (Mitnahme des Altgeräts und die Stockwerke eingeschlossen). Für Ihre Bestellung fallen keine zusätzlichen Kosten an.",
    },
    {
      id: "dauer",
      question: "Wie lange dauert die Lieferung?",
      keywords: "lieferzeit dauer wann bekommen erhalten wieviele tage woche termin terminabsprache",
      answer:
        "Sobald Ihre Zahlung eingegangen ist, rufen wir Sie an, um gemeinsam den Liefertermin zu vereinbaren. Die Dauer hängt von Ihrer Adresse ab; die bei der Bestellung angegebene Dauer dient nur als Orientierung.",
    },
    {
      id: "installation",
      question: "Installieren Sie das Gerät und nehmen Sie das Altgerät mit?",
      keywords: "installation installationsservice anschliessen anschluss inbetriebnahme rücknahme altgerät recyceln abholung etage treppe hochragen mitnehmen",
      answer:
        "Ja: wählen Sie „Installation“ bei der Bestellung. Installation, Rücknahme Ihres Altgeräts und der Transport in die Stockwerke sind kostenlos.",
    },
    {
      id: "zahlung",
      question: "Wie bezahle ich meine Bestellung?",
      keywords: "zahlung bezahlen zahlungsmethode zahlungsart kreditkarte debit visa mastercard paypal scheck bar raten kredit finanzierung ueberweisung akzeptiert",
      answer:
        "Die Zahlung erfolgt ausschließlich per Banküberweisung vor der Lieferung. Nach Bestätigung Ihrer Bestellung werden die Kontodaten auf dem Bildschirm angezeigt und Ihnen zusammen mit Ihrem Angebot per E-Mail zugesendet. Ihre Artikel bleiben bis zum Zahlungseingang reserviert. Kreditkarte, PayPal und Ratenzahlung werden nicht angeboten.",
    },
    {
      id: "rib",
      question: "Wo finde ich die Bankverbindung für die Überweisung?",
      keywords: "rib iban bic bankverbindung zweck überweisung bank ueberweisungshinweis referenz verwendungszweck",
      answer:
        "Die Bankverbindung (IBAN, BIC und Verwendungszweck) wird direkt nach Bestellbestätigung angezeigt und steht auch in dem per E-Mail gesendeten Angebot. Achten Sie auf den angegebenen Verwendungszweck, damit Ihre Überweisung schnell erkannt wird.",
    },
    {
      id: "rechnung",
      question: "Wie erhalte ich meine Rechnung?",
      keywords: "rechnung angebot beleg erhalten bekommen dokument nachweis",
      answer: "Ihr Angebot senden wir Ihnen per E-Mail direkt nach der Bestellung. Die Rechnung senden wir Ihnen per E-Mail, sobald Ihre Überweisung eingegangen ist; Sie finden sie auch in Ihrem Kundenkonto.",
      links: [{ label: "Meine Bestellungen", href: "/compte/commandes" }],
    },
    {
      id: "verfolgung",
      question: "Wie verfolge ich meine Bestellung?",
      keywords: "verfolgen verfolgung bestellung status stand fortschritt erhalten raus versandt versendet",
      answer:
        "Melden Sie sich in Ihrem Kundenkonto an, im Bereich „Meine Bestellungen“: der Status jeder Bestellung wird dort aktualisiert. Sie erhalten auch bei jedem Schritt eine E-Mail (Überweisung erhalten, Vorbereitung, Zustellung). Sie haben ohne Kundenkonto bestellt? Erstellen Sie es einfach mit dem Link aus der Bestellbestätigungs-E-Mail.",
      links: [{ label: "Meine Bestellungen", href: "/compte/commandes" }],
    },
    {
      id: "stornierung",
      question: "Kann ich meine Bestellung ändern oder stornieren?",
      keywords: "stornieren stornierung ändern änderung korrigieren bestellung fehler",
      answer: `Kontaktieren Sie uns bitte so schnell wie möglich${contactLine ? `, ${contactLine}` : ""}: Solange die Bestellung nicht verschickt wurde, können wir sie noch ändern oder stornieren.`,
      contact: true,
    },
    {
      id: "rueckgabe",
      question: "Wie gebe ich ein Produkt zurück?",
      keywords: "rückgabe retoure erstatten erstattung widerrufsrecht umta uschen zurücksenden zufrieden",
      answer:
        "Sie haben 14 Tage ab Erhalt Ihrer Bestellung Zeit, Ihr Widerrufsrecht ohne Angabe von Gründen auszuüben. Die Bedingungen und das Vorgehen sind in unseren Allgemeinen Geschäftsbedingungen beschrieben.",
      links: [{ label: "Allgemeine Geschäftsbedingungen", href: "/cgv" }],
      contact: true,
    },
    {
      id: "garantie",
      question: "Welche Garantie gilt für Ihre Produkte?",
      keywords: "garantie gewährleistung sav defekt reparatur mangel kaputt funktioniert nicht mehr problem",
      answer:
        "Alle unsere Produkte unterliegen den gesetzlichen Gewährleistungsrechten; die Garantiedauer eines jeden Produkts finden Sie auf dessen Seite. Bei Defekt oder Problem schildern Sie uns die Situation: Unser Team meldet sich, um gemeinsam eine Lösung zu finden.",
      links: [{ label: "Allgemeine Geschäftsbedingungen", href: "/cgv" }],
      contact: true,
    },
    {
      id: "kontakt",
      question: "Wie kann ich Sie kontaktieren?",
      keywords: "kontakt kontaktieren erreichen telefonier nummer anrufen e-mail schreiben kundenservice",
      answer: `Sie erreichen uns ${contactLine || "über die Kontaktseite"}.${store.hours ? ` ${store.hours}.` : ""}`,
    },
    {
      id: "adresse",
      question: "Wo befindet sich das Geschäft und wie sind die Öffnungszeiten?",
      keywords: "adresse geschäft laden anschrift ort finden kommen filiale öffnungszeiten offen schliessen öffnungszeiten schließzeit uhr sonntag",
      answer: `${store.siteName}${store.address ? ` — ${store.address}` : ""}.${store.storeHours ? ` ${store.storeHours}.` : ""}`,
    },
    {
      id: "promo",
      question: "Gibt es bei Ihnen Aktionen?",
      keywords: "promo aktion[s]? sale reduziert herabsetzung gutscheincode angebot angebotsaktion destockage weniger teuer preis",
      answer: `Alle unsere Preise sind Abverkaufspreise, deutlich unter der unverbindlichen Preisempfehlung des Herstellers. Zusätzlich erhalten Sie auf Geräte über ${BIG_TICKET_OFFER.thresholdEuros.toLocaleString("de-DE")} € ${BIG_TICKET_OFFER.percent} % Extra-Rabatt, automatisch im Warenkorb abgezogen.`,
      links: [{ label: "Angebote ansehen", href: "/promotions" }],
    },
    {
      id: "konto",
      question: "Brauche ich ein Konto, um zu bestellen?",
      keywords: "konto erstellen registrieren registrierung anmeldung einloggen anmelden kennwort passwort vergessen login",
      answer:
        "Nein: Sie können mit Ihrer E-Mail-Adresse allein bestellen und danach Ihr Konto mit dem Link erstellen, den Sie nach der Bestellung erhalten. Passwort vergessen? Nutzen Sie den Link „Passwort vergessen“ auf der Anmeldeseite.",
      links: [{ label: "Anmelden", href: "/connexion" }],
    },
    {
      id: "bestand",
      question: "Ist das Produkt verfügbar?",
      keywords: "lager verfügbar verfügbarkeit ausverkauft leerverkauf wiederauffuellung menge",
      answer:
        "Die Verfügbarkeit sehen Sie auf jeder Produktseite und sie wird in Echtzeit aktualisiert. Vorhandene Produkte sind ab Bestellbestätigung für Sie reserviert.",
    },
  ];
  if (brands.length) {
    entries.push({
      id: "marques",
      question: "Welche Marken verkaufen Sie?",
      keywords: "marke marken hersteller verkaufen offerieren",
      answer: `Wir führen unter anderem: ${brands.slice(0, 14).join(", ")}.`,
      links: [{ label: "Shop ansehen", href: "/boutique" }],
    });
  }
  for (const r of rayons) {
    if (r.count < 1) continue;
    entries.push({
      id: `rayon-${r.slug}`,
      question: `Haben Sie ${r.nom}?`,
      keywords: [r.nom, RAYON_WORDS[r.slug] ?? "", ...r.sousCategories].join(" "),
      answer: `Ja: ${r.count} Produkt${r.count > 1 ? "e" : ""} ${r.count > 1 ? "sind" : "ist"} gerade in unserem Sortiment verfügbar, zu Abverkaufspreisen und mit kostenloser Lieferung (${r.nom}).`,
      links: [{ label: `Kategorie ${r.nom} ansehen`, href: `/categorie/${r.slug}` }],
      source: "rayon",
    });
  }
  return entries.map((e) => ({ ...e, source: e.source ?? "site" }));
}

/** Questions de la FAQ WordPress. */
export function faqKnowledge(faq: { title: string; items: { question: string; answer: string }[] }[]): KnowledgeEntry[] {
  return faq.flatMap((cat, i) =>
    cat.items
      .filter((it) => it.question?.trim() && it.answer?.trim())
      .map((it, j) => ({ id: `faq-${i}-${j}`, question: it.question.trim(), keywords: cat.title, answer: it.answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), source: "faq" as const })),
  );
}

/* ------------------------------------------------------------------------------- Moteur */

type Indexed = KnowledgeEntry;

export interface Assistant {
  reply(question: string): AssistantReply;
}

export function createAssistant(entries: KnowledgeEntry[], opts: { botName: string; welcome: string }): Assistant {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index = new MiniSearch<Indexed>({
    fields: ["question", "keywords", "answer"],
    storeFields: ["id"],
    tokenize: (text) => tokenize(text),
    processTerm: (term) => termOf(term),
    searchOptions: {
      boost: { question: 2, keywords: 1.6, answer: 0.35 },
      fuzzy: (term) => (term.length > 5 ? 0.2 : false),
      prefix: (term) => term.length > 4,
      combineWith: "OR",
      // Réponses du site (à jour) avant la FAQ, rayons du catalogue en dernier.
      boostDocument: (id) => {
        const e = byId.get(String(id));
        return e?.source === "site" ? 1.6 : e?.source === "rayon" ? 0.8 : 1;
      },
    },
  });
  index.addAll(entries);

  /** Part de la question couverte par une réponse (mots clés comptés double, mots vagues à moitié). */
  const coverage = (terms: string[], r: SearchResult) => {
    const matched = new Set(r.queryTerms);
    const total = terms.reduce((n, t) => n + weightOf(t), 0);
    const hit = terms.filter((t) => matched.has(t)).reduce((n, t) => n + weightOf(t), 0);
    return { ratio: total ? hit / total : 0, hit };
  };

  return {
    reply(question) {
      const text = normalize(question).replace(/[^a-z0-9]+/g, " ").trim();
      if (!text) return { kind: "smalltalk", text: opts.welcome, suggestions: STARTERS };
      for (const s of SMALLTALK) if (s.re.test(text)) return s.reply(opts);

      const terms = termsOf(question);
      if (!terms.length) return { kind: "smalltalk", text: "Können Sie Ihre Frage präzisieren?", suggestions: STARTERS };
      const service = terms.some((t) => SERVICE_CONCEPTS.has(t));
      const results = index
        .search(question)
        // Une question de service (livraison, panne…) ne renvoie pas vers un rayon du catalogue.
        .filter((r) => !(service && byId.get(String(r.id))?.source === "rayon"))
        .map((r) => ({ r, entry: byId.get(String(r.id))!, ...coverage(terms, r) }));

      // Réponse fiable : elle couvre au moins la moitié de la question, dont un mot clé (ou l'unique mot posé).
      const confident = results.filter((x) => x.ratio >= 0.5 && (x.hit >= 1.5 || (terms.length === 1 && x.hit >= 1)));
      // La réponse qui couvre le mieux la question ; à égalité, celles du site (à jour) avant la FAQ.
      const rank = { site: 0, faq: 1, rayon: 2 } as const;
      const best = confident.sort((a, b) => Math.round(b.ratio * 10) - Math.round(a.ratio * 10) || rank[a.entry.source ?? "faq"] - rank[b.entry.source ?? "faq"] || b.r.score - a.r.score)[0];
      if (best) {
        const e = best.entry;
        return {
          kind: "answer",
          text: e.answer,
          links: e.links,
          ...(e.contact ? { contactForm: true } : {}),
        };
      }
      const close = results.filter((x) => x.ratio >= 0.25 && x.entry.source !== "rayon").slice(0, 3).map((x) => x.entry.question);
      return {
        kind: "unknown",
        text: "Ich habe keine sichere Antwort auf Ihre Frage gefunden. Hinterlassen Sie Ihre Kontaktdaten: Unser Team meldet sich schnell bei Ihnen.",
        contactForm: true,
        ...(close.length ? { suggestions: close } : {}),
      };
    },
  };
}
