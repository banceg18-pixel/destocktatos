import MiniSearch, { type SearchResult } from "minisearch";
import { normalize } from "@/lib/text";
import { BIG_TICKET_OFFER } from "@/lib/offers";
import { STARTERS } from "./starters";

/**
 * Assistant du site : répond aux questions fréquentes (livraison, paiement, commande, retours,
 * garantie, contact, rayons du catalogue, puis la FAQ gérée dans WordPress). Tout tourne sur le
 * serveur du site, sans service externe : la question est ramenée à ses mots utiles (accents,
 * pluriels et synonymes compris), puis comparée aux réponses connues, fautes de frappe tolérées.
 * Sans réponse fiable, l'assistant le dit et propose au client de laisser ses coordonnées pour être
 * recontacté par l'équipe.
 */

export interface AssistantLink {
  label: string;
  href: string;
}

export interface AssistantReply {
  /** answer : réponse trouvée ; smalltalk : politesse ; callback : le client demande à être recontacté ; unknown : pas de réponse fiable. */
  kind: "answer" | "smalltalk" | "callback" | "unknown";
  text: string;
  links?: AssistantLink[];
  /** Questions proposées en un clic. */
  suggestions?: string[];
  /** Afficher le formulaire « être recontacté ». */
  contactForm?: boolean;
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  /** Mots et expressions qui mènent à cette réponse (synonymes, formulations courantes). */
  keywords: string;
  answer: string;
  links?: AssistantLink[];
  source: "site" | "faq" | "rayon";
  /** Après la réponse, proposer aussi d'être recontacté (panne, annulation…). */
  contact?: boolean;
}

/* ------------------------------------------------------------------------------- Mots de la question */

const STOP_WORDS = new Set(
  (
    "a ai aie as au aux avec avez avoir avons c ca ce ceci cela celle celui ces cet cette chez d dans de des du elle elles en est et etre eu " +
    "fait faire faut il ils j je l la le les leur leurs lui m ma mais me mes moi mon n ne ni nos notre nous on ont ou par pas peu peut peux " +
    "pour pouvez pouvons puis puisse qu que quel quelle quelles quels qui quoi s sa sans se ses si son sont sur svp stp t ta te tes toi ton tu " +
    "un une vos votre vous y est-ce voudrais veux voulez souhaite souhaiterais aimerais bonjour bonsoir salut merci plait sil madame monsieur " +
    "comment combien quand ou pourquoi possible bien tres trop aussi encore deja alors donc oui non dois doit doivent avoir tat"
  ).split(" "),
);

/** Notions clés : les variantes d'un même mot (livrer, livrez, livreur…) deviennent un seul terme. */
const CONCEPTS: [RegExp, string][] = [
  [/^(livr|expedi|achemin|transporteur|colis)/, "livraison"],
  [/^(delai|delais)$/, "delai"],
  [/^(paie|paiement|payement|pay(e|er|ez|es|ons|able)?$|regl)/, "paiement"],
  [/^(virement|vir|rib|iban|bic|banque|bancaire)/, "virement"],
  [/^(carte|cb|visa|mastercard|amex|paypal|cheque|espece|liquide|credit|financement|echelon|fractionn|mensualit)/, "carte"],
  [/^(factur|devis)/, "facture"],
  [/^(command)/, "commande"],
  [/^(suivi|suivre|suis|statut|etat|tracking)$/, "suivi"],
  [/^(annul|modifi)/, "annulation"],
  [/^(retour|retourn|retract|rembours|echang)/, "retour"],
  [/^(garanti|sav|panne|repar|defect|defaut|casse)/, "garantie"],
  [/^(install|branch|raccord|montage|monter|brancher)/, "installation"],
  [/^(repris|recycl|ancien|vieux|vieil|enlev|debarras)/, "reprise"],
  [/^(etage|escalier|ascenseur)/, "etage"],
  [/^(contact|joindre|telephon|numero|tel$|mail|email|courriel|ecrire)/, "contact"],
  [/^(horaire|ouvert|ouverture|ferme|fermeture|heure|dimanche|samedi|lundi|ferie)/, "horaire"],
  [/^(adresse|situe|magasin|showroom|sevran|locaux)/, "adresse"],
  [/^(promo|solde|reduc|remise|rabais|coupon|destock|discount|reduction)/, "promo"],
  [/^(prix|tarif|cout|coute|couter|cher|chere)$/, "prix"],
  [/^(compte|inscri|connex|identifi|login|password|mdp)/, "compte"],
  [/^(stock|dispo|rupture|reappro|epuise)/, "stock"],
  [/^(gratuit|offert|payant)/, "gratuit"],
  [/^(marque|fabricant)/, "marque"],
  [/^(frigo|frigidair|refrig)/, "refrigerateur"],
  [/^(congel)/, "congelateur"],
  [/^(clim)/, "climatiseur"],
  [/^(tele|tv|televi|televiseur)$/, "television"],
  [/^(aspi)/, "aspirateur"],
  [/^(gaziniere)/, "cuisiniere"],
];
const CONCEPT_NAMES = new Set(CONCEPTS.map(([, c]) => c));
/** Notions de service : quand la question en contient une, elle ne porte pas sur un rayon du catalogue. */
const SERVICE_CONCEPTS = new Set(["livraison", "delai", "paiement", "virement", "carte", "facture", "commande", "suivi", "annulation", "retour", "garantie", "installation", "reprise", "etage", "contact", "horaire", "adresse", "compte"]);
/** Mots trop courants pour suffire à eux seuls à choisir une réponse. */
const WEAK_WORDS = new Set(["france", "site", "produit", "produits", "appareil", "article", "client", "service", "question", "info", "information", "savoir", "avoir"]);

/** Terme utile d'un mot (ou null pour un mot vide) : sans accents, notion clé, sans pluriel. */
export function termOf(word: string): string | null {
  const t = normalize(word).replace(/[^a-z0-9]/g, "");
  // Mots vides, nombres et références (numéro de commande…) : sans intérêt pour choisir une réponse.
  if (!t || STOP_WORDS.has(t) || /\d/.test(t)) return null;
  for (const [re, concept] of CONCEPTS) if (re.test(t)) return concept;
  return t.length > 4 ? t.replace(/(?<=[a-z])[sx]$/, "") : t;
}

/** Expressions ramenées à un mot clé avant découpage (« où en est » → suivi, « ne marche plus » → panne…). */
const PHRASES: [RegExp, string][] = [
  [/\bou en (est|sont)\b/g, " suivi "],
  [/\b(pas|jamais) (encore )?(recu|arrive|livre)e?s?\b/g, " suivi livraison "],
  [/\bne (marche|fonctionne|demarre|chauffe|refroidit|essore) (plus|pas)\b/g, " panne "],
  [/\b(en )?combien de (temps|jours)\b/g, " delai "],
  [/\bplusieurs fois\b/g, " carte "],
  [/\bmot de passe\b/g, " compte "],
  [/\bcode promo\b/g, " promo "],
  [/\bmachine a laver\b/g, " lave linge "],
  [/\bfrais de port\b/g, " livraison prix "],
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

const SMALLTALK: { re: RegExp; reply: (ctx: { botName: string; welcome: string }) => AssistantReply }[] = [
  {
    re: /^(bonjour|bonsoir|salut|hello|coucou|hey|bjr|slt|cc|yo)( a vous| tout le monde)?$/,
    reply: ({ welcome }) => ({ kind: "smalltalk", text: welcome, suggestions: STARTERS }),
  },
  {
    re: /^(ok |d accord |super |parfait |top )?(merci|thanks|merci beaucoup|merci bien|parfait merci|super merci|top merci)( a vous| bien| beaucoup)?$/,
    reply: () => ({ kind: "smalltalk", text: "Avec plaisir ! Avez-vous une autre question ?" }),
  },
  {
    re: /^(ok|okay|d accord|dac|ca marche|tres bien|entendu|parfait|super|top|cool|genial)$/,
    reply: () => ({ kind: "smalltalk", text: "Très bien. N'hésitez pas si vous avez une autre question." }),
  },
  {
    re: /^(au revoir|bye|a bientot|a plus|bonne (journee|soiree|nuit|fin de journee))( merci)?$/,
    reply: () => ({ kind: "smalltalk", text: "Merci de votre visite et à bientôt sur Destocktatos !" }),
  },
  {
    re: /(qui es tu|qui etes vous|t es qui|tu es qui|es tu (un )?(robot|humain|bot|ia|vrai)|etes vous (un )?(robot|humain|bot|ia)|tu es (un )?(robot|bot|ia)|c est un robot|une ia|intelligence artificielle)/,
    reply: ({ botName }) => ({
      kind: "smalltalk",
      text: `Je suis ${botName}, l'assistant automatique du site. Je réponds aux questions fréquentes : livraison, paiement, commandes, retours, garantie… Si je n'ai pas la réponse, je transmets votre demande à l'équipe, qui vous recontacte.`,
      suggestions: STARTERS,
    }),
  },
  {
    re: /(rappel|recontact|appelez moi|m appeler|me rappeler|parler (a|avec) (un|une|quelqu)|un conseiller|une conseillere|un humain|une vraie personne|un vendeur|une vendeuse|un operateur)/,
    reply: () => ({
      kind: "callback",
      text: "Bien sûr. Laissez vos coordonnées et votre question : notre équipe vous recontacte rapidement.",
      contactForm: true,
    }),
  },
];


/* ------------------------------------------------------------------------------- Connaissances du site */

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

/** Synonymes des rayons, pour reconnaître « frigo », « machine à laver »… */
const RAYON_WORDS: Record<string, string> = {
  refrigerateur: "frigo refrigerateur frigidaire combine americain side by side cave a vin",
  congelateur: "congelateur congel coffre armoire",
  "lave-linge": "lave linge machine a laver hublot top",
  "seche-linge": "seche linge sechoir pompe a chaleur condensation",
  "lave-vaisselle": "lave vaisselle",
  cuisiniere: "cuisiniere gaziniere piano",
  four: "four encastrable pyrolyse",
  "plaque-de-cuisson": "plaque cuisson table induction vitroceramique",
  "plaque-a-gaz": "plaque gaz",
  "micro-ondes": "micro ondes microondes",
  hotte: "hotte aspirante",
  aspirateur: "aspirateur aspi robot balai",
  climatiseur: "climatiseur clim climatisation",
  "robot-de-cuisine": "robot cuisine patissier blender mixeur",
  television: "television tele tv televiseur ecran",
  autres: "petit electromenager friteuse air fryer centrale vapeur grille pain",
};

type Draft = Omit<KnowledgeEntry, "source"> & { source?: KnowledgeEntry["source"] };

export function siteKnowledge(store: StoreInfo, rayons: Rayon[], brands: string[]): KnowledgeEntry[] {
  const contactLine = [store.phone && `par téléphone au ${store.phone}`, store.email && `par email à ${store.email}`].filter(Boolean).join(" ou ");
  const entries: Draft[] = [
    {
      id: "livraison",
      question: "Combien coûte la livraison ?",
      keywords: "livraison livrer livrez frais de port prix cout gratuit offert payant partout france zone region ville corse domicile combien",
      answer:
        "La livraison est offerte partout en France, quel que soit le mode choisi : au pied du camion, dans la pièce de votre choix, ou avec installation (reprise de l'ancien appareil et étages compris). Aucun frais n'est ajouté à votre commande.",
    },
    {
      id: "delai",
      question: "Quel est le délai de livraison ?",
      keywords: "delai livraison quand recevoir recu combien de temps jours semaine date rendez vous creneau",
      answer:
        "Dès que votre paiement est reçu, nous vous appelons pour convenir ensemble du jour de livraison. Le délai dépend de votre adresse ; celui indiqué à la commande est donné à titre indicatif.",
    },
    {
      id: "installation",
      question: "Installez-vous l'appareil et reprenez-vous l'ancien ?",
      keywords: "installation installer brancher branchement raccordement mise en service reprise ancien appareil recyclage enlevement etage escalier monter",
      answer:
        "Oui : choisissez « Installation » au moment de la commande. L'installation, la reprise de votre ancien appareil et la montée dans les étages sont offertes.",
    },
    {
      id: "paiement",
      question: "Comment payer ma commande ?",
      keywords: "paiement payer moyen de paiement carte bancaire cb visa mastercard paypal cheque especes plusieurs fois credit financement virement accepte",
      answer:
        "Le paiement se fait uniquement par virement bancaire, avant la livraison. Après avoir confirmé votre commande, les coordonnées bancaires s'affichent à l'écran et vous sont envoyées par email avec votre devis. Vos articles restent réservés en attendant le virement. La carte bancaire, PayPal et le paiement en plusieurs fois ne sont pas proposés.",
    },
    {
      id: "rib",
      question: "Où trouver les coordonnées bancaires pour le virement ?",
      keywords: "rib iban bic coordonnees bancaires virement banque communication reference",
      answer:
        "Les coordonnées bancaires (IBAN, BIC et communication à indiquer) s'affichent dès la confirmation de votre commande et figurent sur le devis envoyé par email. Indiquez bien la communication demandée pour que votre virement soit reconnu rapidement.",
    },
    {
      id: "facture",
      question: "Comment recevoir ma facture ?",
      keywords: "facture devis recevoir obtenir document justificatif",
      answer: "Votre devis vous est envoyé par email dès la commande. La facture vous est envoyée par email dès que votre virement est reçu ; vous la retrouvez aussi dans votre compte.",
      links: [{ label: "Mes commandes", href: "/compte/commandes" }],
    },
    {
      id: "suivi",
      question: "Comment suivre ma commande ?",
      keywords: "suivre suivi commande statut etat ou en est avancement recue partie expediee",
      answer:
        "Connectez-vous à votre compte, rubrique « Mes commandes » : le statut de chaque commande y est à jour. Vous recevez aussi un email à chaque étape (virement reçu, préparation, livraison). Vous avez commandé sans compte ? Créez-le avec le lien reçu dans l'email de confirmation de commande.",
      links: [{ label: "Mes commandes", href: "/compte/commandes" }],
    },
    {
      id: "annulation",
      question: "Puis-je modifier ou annuler ma commande ?",
      keywords: "annuler annulation modifier modification changer commande erreur",
      answer: `Contactez-nous au plus vite${contactLine ? `, ${contactLine}` : ""} : tant que la commande n'est pas partie, nous pouvons la modifier ou l'annuler.`,
      contact: true,
    },
    {
      id: "retour",
      question: "Comment retourner un produit ?",
      keywords: "retour retourner rembourser remboursement retractation echanger echange renvoyer satisfait",
      answer:
        "Vous disposez de 14 jours à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à vous justifier. Les conditions et la marche à suivre sont détaillées dans nos conditions générales de vente.",
      links: [{ label: "Conditions générales de vente", href: "/cgv" }],
      contact: true,
    },
    {
      id: "garantie",
      question: "Quelle est la garantie de vos produits ?",
      keywords: "garantie garanti sav panne reparation defaut casse ne marche plus ne fonctionne plus probleme",
      answer:
        "Tous nos produits bénéficient de la garantie légale de conformité, et la durée de garantie de chaque produit est indiquée sur sa fiche. En cas de panne ou de problème, décrivez-nous la situation : notre équipe vous recontacte pour trouver une solution.",
      links: [{ label: "Conditions générales de vente", href: "/cgv" }],
      contact: true,
    },
    {
      id: "contact",
      question: "Comment vous contacter ?",
      keywords: "contact contacter joindre telephone numero appeler email mail ecrire service client",
      answer: `Vous pouvez nous joindre ${contactLine || "depuis la page Contact"}.${store.hours ? ` ${store.hours}.` : ""}`,
    },
    {
      id: "adresse",
      question: "Où se trouve le magasin et quels sont vos horaires ?",
      keywords: "adresse magasin ou situe trouver venir locaux horaires ouvert ouverture ferme fermeture heure dimanche",
      answer: `${store.siteName}${store.address ? ` — ${store.address}` : ""}.${store.storeHours ? ` ${store.storeHours}.` : ""}`,
    },
    {
      id: "promo",
      question: "Avez-vous des promotions ?",
      keywords: "promo promotion solde reduction remise code promo bon plan offre destockage moins cher prix",
      answer: `Tous nos prix sont des prix de déstockage, nettement sous le prix conseillé du fabricant. En plus, les produits à plus de ${BIG_TICKET_OFFER.thresholdEuros.toLocaleString("fr-FR")} € bénéficient de ${BIG_TICKET_OFFER.percent} % de remise supplémentaire, appliquée automatiquement au panier.`,
      links: [{ label: "Voir les promotions", href: "/promotions" }],
    },
    {
      id: "compte",
      question: "Faut-il un compte pour commander ?",
      keywords: "compte creer inscription inscrire connexion connecter identifiant mot de passe oublie login",
      answer:
        "Non : vous pouvez commander avec votre seul email, puis créer votre compte grâce au lien reçu après la commande. Mot de passe oublié ? Utilisez le lien « Mot de passe oublié » de la page de connexion.",
      links: [{ label: "Se connecter", href: "/connexion" }],
    },
    {
      id: "stock",
      question: "Le produit est-il disponible ?",
      keywords: "stock disponible disponibilite rupture reapprovisionnement epuise quantite",
      answer:
        "La disponibilité est indiquée sur chaque fiche produit et mise à jour en temps réel. Les produits en stock sont réservés pour vous dès la confirmation de la commande.",
    },
  ];
  if (brands.length) {
    entries.push({
      id: "marques",
      question: "Quelles marques vendez-vous ?",
      keywords: "marque marques fabricant vendez proposez",
      answer: `Nous proposons notamment : ${brands.slice(0, 14).join(", ")}.`,
      links: [{ label: "Voir la boutique", href: "/boutique" }],
    });
  }
  for (const r of rayons) {
    if (r.count < 1) continue;
    entries.push({
      id: `rayon-${r.slug}`,
      question: `Avez-vous des ${r.nom} ?`,
      keywords: [r.nom, RAYON_WORDS[r.slug] ?? "", ...r.sousCategories].join(" "),
      answer: `Oui : ${r.count} produit${r.count > 1 ? "s" : ""} ${r.count > 1 ? "sont disponibles" : "est disponible"} en ce moment dans notre rayon ${r.nom}, à prix de déstockage et livraison offerte.`,
      links: [{ label: `Voir le rayon ${r.nom}`, href: `/categorie/${r.slug}` }],
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
      if (!terms.length) return { kind: "smalltalk", text: "Pouvez-vous préciser votre question ?", suggestions: STARTERS };
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
      const best = confident.sort((a, b) => Math.round(b.ratio * 10) - Math.round(a.ratio * 10) || rank[a.entry.source] - rank[b.entry.source] || b.r.score - a.r.score)[0];
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
        text: "Je n'ai pas trouvé de réponse sûre à votre question. Laissez vos coordonnées : notre équipe vous recontacte rapidement.",
        contactForm: true,
        ...(close.length ? { suggestions: close } : {}),
      };
    },
  };
}
