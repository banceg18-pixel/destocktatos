# -*- coding: utf-8 -*-
"""Scan des pages en ligne (destocktatos.com) pour trouver le texte français restant."""
import re, os, sys
from urllib.request import Request, urlopen

PAGES = sys.argv[1:] or [
    "/", "/boutique", "/faq", "/cgv", "/politique-confidentialite", "/a-propos",
    "/services", "/promotions", "/contact", "/connexion", "/inscription", "/conseils",
    "/panier", "/paiement", "/signaler-bug", "/mentions-legales",
    "/categorie/refrigerateur", "/categorie/lave-linge", "/categorie/four",
    "/categorie/kuehlschrank", "/categorie/waschmaschine", "/categorie/backofen",
]

# Mots français sans ambiguïté (absents de l'allemand dans ce sens)
FR = re.compile(
    r"(?i)\b(livraison|livré|commande|panier|magnifique|votre|vos|vous\b|merci|bienvenue"
    r"|afficher|masquer|quantité|continuer|retour aux|valider|envoyer|rechercher|veuillez"
    r"|obligatoire|facultatif|mot de passe|créer un|déjà inscrit|prix|produits|articles"
    r"|gratuit|offerte?|conseillé|fabriquant|fabricant|stock|rupture|résultats|filtres?"
    r"|euros?|mon compte|se connecter|s'enregistrer|découvrir|accéder|reçu|chaque"
    r"|tout\b|toute\b|tous\b|être|avec\b|sans\b|dans\b|chez\b|pour\b|nous\b|notre)\b"
)

for p in PAGES:
    try:
        req = Request("https://destocktatos.com" + p, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "de"})
        html = urlopen(req, timeout=20).read().decode("utf-8", "replace")
    except Exception as e:
        print(f"== {p} : ERREUR {e}")
        continue
    texts = re.findall(r'>([^<>]{4,200})<', html)
    texts += re.findall(r'"children":"([^"]{4,200})"', html)
    texts += re.findall(r'"text":"([^"]{4,200})"', html)
    seen = {}
    for t in texts:
        for m in FR.finditer(t):
            w = m.group(0).lower()
            # "des/un/est" existent en allemand — ignorer les faux positifs allemands
            if w in ("des", "un", "est", "tout", "toute", "tous", "avec", "sans", "dans", "pour", "nous", "vous", "mon", "chaque"):
                ctx = t[:1]
                continue
            if w not in seen:
                seen[w] = t.strip()[:110]
    if seen:
        print(f"== {p} : {len(seen)} ==")
        for w, t in list(seen.items())[:16]:
            print(f"  {w} → {t}")
    else:
        print(f"== {p} : OK (aucun mot français détecté)")
