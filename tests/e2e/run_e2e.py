#!/usr/bin/env python3
"""
Tests API, de bout en bout et responsive sur le build de production (Playwright / Chromium).

Prérequis : `npm run build`, Python 3.10+ avec `playwright` (python -m playwright install chromium).

    npm run test:e2e
        -> recrée prisma/e2e.db (migrations + seed), démarre `next start` sur :3100 avec cette base,
           exécute les tests, arrête le serveur. La base de développement n'est jamais modifiée.
    python tests/e2e/run_e2e.py --base-url http://localhost:3000 --no-server   # serveur déjà démarré
    python tests/e2e/run_e2e.py --only api,achat                                # filtrer par groupe/nom

Résultats : test-results/e2e/report.json, captures d'écran (échecs et responsive), journal serveur.
Paiement : simulation activée pour ces tests seulement (TEST_PAYMENTS=true, aucune clé Stripe) et règlement à la livraison.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "test-results" / "e2e"
# Motifs du site d'origine (domaine, CDN) : source unique partagée avec l'audit statique.
SOURCE_PATTERNS = re.compile("|".join(json.loads((ROOT / "scripts/audit-patterns.json").read_text(encoding="utf-8"))["patterns"]), re.I)

# Produits du catalogue d'origine utilisés par les parcours (en stock dans le seed).
CHEAP = "aspirateur-voiture-twc01-thisworx"  # 20 €, 1,1 kg
STORE_ADDRESS = "15 Rue Paul Langevin 93270 Sevran"

VIEWPORTS = {
    "desktop-1440": (1440, 900),
    "desktop-1280": (1280, 800),
    "desktop-1024": (1024, 768),
    "tablette-768-portrait": (768, 1024),
    "tablette-1024-paysage": (1024, 768),
    "mobile-430": (430, 932),
    "mobile-390": (390, 844),
    "mobile-375": (375, 667),
}
RESPONSIVE_ROUTES = [
    "/",
    "/boutique",
    f"/boutique/{CHEAP}",
    "/categorie/lave-linge",
    "/promotions",
    "/services",
    "/contact",
    "/a-propos",
    "/faq",
    "/panier",
    "/connexion",
    "/inscription",
    "/signaler-bug",
    "/cgv",
    "/mentions-legales",
    "/politique-confidentialite",
]

# --------------------------------------------------------------------------- harnais


class Skip(Exception):
    """Test non exécutable dans cet environnement (raison affichée dans le rapport)."""


TESTS: list[tuple[str, str, object]] = []
RESULTS: list[dict] = []
REQUEST_HOSTS: dict[str, int] = {}
SOURCE_REQUESTS: list[str] = []


def test(group: str, name: str):
    def deco(fn):
        TESTS.append((group, name, fn))
        return fn

    return deco


def check(cond, message: str):
    if not cond:
        raise AssertionError(message)


def eq(actual, expected, message: str):
    if actual != expected:
        raise AssertionError(f"{message} : attendu {expected!r}, obtenu {actual!r}")


_ip = 0


def fresh_ip() -> str:
    """Adresse distincte par contexte : la limitation de débit par IP ne mélange pas les tests."""
    global _ip
    _ip += 1
    return f"10.77.{_ip // 250}.{_ip % 250 + 1}"


class Env:
    base: str
    pw: Playwright
    browser: Browser
    demo: dict
    page_errors: list[str]


ENV = Env()


def watch(page: Page, errors: list[str]):
    """Enregistre requêtes (hôtes, références à la source), erreurs console et réponses en échec."""
    base_host = urlparse(ENV.base).netloc

    def on_request(req):
        host = urlparse(req.url).netloc
        if req.url.startswith(("data:", "blob:")):
            return
        REQUEST_HOSTS[host] = REQUEST_HOSTS.get(host, 0) + 1
        if SOURCE_PATTERNS.search(req.url):
            SOURCE_REQUESTS.append(req.url)

    def on_console(msg):
        # « Failed to load resource » double les réponses HTTP, suivies ci-dessous (les 4xx d'API
        # sont souvent attendues : mauvais mot de passe, validation).
        if msg.type == "error" and not msg.text.startswith("Failed to load resource"):
            loc = (msg.location or {}).get("url", "")
            if not loc or urlparse(loc).netloc in ("", base_host):
                errors.append(f"console: {msg.text[:300]}")

    def on_response(res):
        if urlparse(res.url).netloc != base_host:
            return
        if res.status >= 500 or (res.status >= 400 and "/api/" not in res.url):
            errors.append(f"HTTP {res.status} {res.url}")

    def on_failed(req):
        # Les préchargements RSC (?_rsc=) annulés lors d'une navigation ne sont pas des erreurs.
        if urlparse(req.url).netloc == base_host and "ERR_ABORTED" not in (req.failure or ""):
            errors.append(f"échec requête {req.url} {req.failure}")

    page.on("request", on_request)
    page.on("console", on_console)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:300]}"))
    page.on("response", on_response)
    page.on("requestfailed", on_failed)


def new_context(viewport=(1440, 900), consent="rejected", **kw) -> BrowserContext:
    ctx = ENV.browser.new_context(
        base_url=ENV.base,
        viewport={"width": viewport[0], "height": viewport[1]},
        locale="fr-FR",
        **kw,
    )
    # Adresse distincte par contexte, uniquement vers le serveur testé : ajoutée aux requêtes tierces
    # (ex. API Adresse appelée par le navigateur), l'en-tête ferait échouer leur contrôle CORS.
    ip = fresh_ip()
    ctx.route(f"{ENV.base}/**", lambda route: route.continue_(headers={**route.request.headers, "x-forwarded-for": ip}))
    if consent:
        ctx.add_init_script(f"try {{ localStorage.getItem('cookieConsent') || localStorage.setItem('cookieConsent', '{consent}'); }} catch (e) {{}}")
    ctx.set_default_timeout(20_000)
    return ctx


def new_page(ctx: BrowserContext, errors: list[str] | None = None) -> Page:
    page = ctx.new_page()
    watch(page, errors if errors is not None else [])
    return page


def api(user: dict | None = None):
    """Contexte HTTP (cookies conservés) ; connecté via NextAuth si `user` est fourni."""
    req = ENV.pw.request.new_context(base_url=ENV.base, extra_http_headers={"x-forwarded-for": fresh_ip()})
    if user:
        csrf = req.get("/api/auth/csrf").json()["csrfToken"]
        req.post("/api/auth/callback/credentials", form={"csrfToken": csrf, "email": user["email"], "mdp": user["password"], "json": "true"})
        session = req.get("/api/auth/session").json()
        eq((session.get("user") or {}).get("email"), user["email"], "session NextAuth")
    return req


_user_seq = 0


def register_user(prefix="e2e") -> dict:
    global _user_seq
    _user_seq += 1
    user = {"email": f"{prefix}-{int(time.time())}-{_user_seq}@tatos.test", "password": f"Essai{_user_seq}2026x"}
    with_req = api()
    r = with_req.post("/api/auth/register", data={"email": user["email"], "mdp": user["password"], "mdpv": user["password"]})
    eq(r.status, 201, f"inscription {user['email']}")
    with_req.dispose()
    return user


def wait_hydrated(page: Page):
    """
    Attend la fin du rendu en flux et de l'hydratation : plus aucun segment différé masqué
    (<div hidden id="S:n">, copie temporaire du contenu pendant le streaming) et React attaché
    au DOM (propriétés internes posées sur les éléments).
    """
    page.wait_for_function(
        """() => {
            if (document.querySelector('div[hidden][id^="S:"]')) return false;
            // Repère posé par le site une fois tout l'arbre hydraté (effet de NetworkStatus).
            return document.documentElement.dataset.hydrated === "1";
        }""",
        timeout=30_000,
    )


def go(page: Page, url: str):
    resp = page.goto(url)
    wait_hydrated(page)
    return resp


def cart_count(page: Page) -> int:
    # Deux liens panier (menu mobile et desktop) : on lit le compteur dans le DOM, visible ou non.
    return page.evaluate("() => { const b = document.querySelector('[data-cy=\"nav-panier\"] span'); return b ? parseInt(b.textContent, 10) || 0 : 0; }")


def open_cart(page: Page):
    """Clic sur l'icône panier (navigation côté client) après être remonté en haut de page."""
    link = page.get_by_role("link", name="Voir le panier et commander")
    if not link.is_visible():
        page.locator('[data-cy="nav-panier"]:visible').first.click()
    link.click()
    page.wait_for_url("**/panier")


def ui_login(page: Page, user: dict, callback="/compte"):
    go(page, f"/connexion?callbackUrl={callback}")
    page.locator('[data-cy="email-input"]:visible').fill(user["email"])
    page.locator('[data-cy="password-input"]:visible').fill(user["password"])
    page.locator('[data-cy="login-submit"]:visible').click()
    # Comparer le chemin exact : « /connexion?callbackUrl=/compte » se termine aussi par « /compte ».
    page.wait_for_url(lambda url: urlparse(url).path == callback, timeout=30_000)
    check(any(c["name"].endswith("next-auth.session-token") for c in page.context.cookies()), "cookie de session posé")


def product(slug: str) -> dict:
    req = api()
    data = req.get(f"/api/produits/search?q={slug.split('-')[0]}&limit=50").json()["produits"]
    req.dispose()
    for p in data:
        if p.get("slug") == slug:
            return p
    raise AssertionError(f"produit {slug} introuvable via l'API de recherche")


def add_to_cart(page: Page, slug: str, quantity=1):
    go(page, f"/boutique/{slug}")
    before = cart_count(page)
    # Le premier bouton est celui de la fiche ; les suivants appartiennent aux suggestions.
    for _ in range(quantity - 1):
        page.get_by_role("button", name="Augmenter la quantité").first.click()
    page.get_by_role("button", name=re.compile("Ajouter au panier")).first.click()
    page.wait_for_function(
        "n => { const b = document.querySelector('[data-cy=\"nav-panier\"] span'); return !!b && parseInt(b.textContent, 10) >= n; }",
        arg=before + quantity,
    )


def outbox_reset_token() -> str | None:
    box = OUT / "outbox"
    files = sorted(box.glob("*reinitialisation-mot-de-passe.json")) if box.exists() else []
    if not files:
        return None
    m = re.search(r"token=([a-f0-9]{64})", json.loads(files[-1].read_text(encoding="utf-8"))["text"])
    return m.group(1) if m else None


TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)

# --------------------------------------------------------------------------- API


@test("api", "catalogue : pagination, filtres, recherche, vedettes, suggestions")
def _():
    req = api()
    r = req.get("/api/produits?page=1")
    eq(r.status, 200, "GET /api/produits")
    d = r.json()
    eq(len(d["produits"]), 12, "12 produits par page (règle source)")
    eq(d["totalPages"], math.ceil(d["total"] / 12), "nombre de pages")
    check(all(p["stock"] > 0 for p in d["produits"]), "la boutique ne liste que des produits en stock")
    dates = [p.get("createdAt") for p in d["produits"]]
    check(dates == sorted(dates, reverse=True), "tri du plus récent au plus ancien")
    eq(req.get("/api/produits?page=0").status, 400, "page=0 refusée")
    eq(len(req.get(f"/api/produits?page={d['totalPages'] + 1}").json()["produits"]), 0, "page au-delà de la fin vide")
    cat = req.get("/api/produits?categorie=lave-linge").json()
    check(cat["total"] > 0 and all(p["categorie"] == "lave-linge" for p in cat["produits"]), "filtre catégorie exact")
    s = req.get("/api/produits/search?q=LAVE%20LINGE").json()["produits"]
    check(len(s) > 0, "recherche insensible à la casse")
    eq(req.get("/api/produits/search?q=r").json()["produits"], [], "recherche < 2 caractères vide")
    eq(len(req.get("/api/produits/vedettes?limit=3").json()["produits"]), 3, "vedettes limitées")
    first = d["produits"][0]
    sug = req.get(f"/api/produits/suggestions?id={first['_id']}&categorie={first['categorie']}").json()
    check(isinstance(sug, list) and all(p["_id"] != first["_id"] for p in sug), "suggestions sans le produit courant")
    eq(req.get("/api/produits/suggestions").status, 400, "suggestions sans paramètre")
    req.dispose()


@test("api", "SEO, en-têtes de sécurité, 404")
def _():
    req = api()
    sm = req.get("/sitemap.xml")
    eq(sm.status, 200, "sitemap")
    check("<urlset" in sm.text() and "/boutique/" in sm.text(), "sitemap contient les fiches produit")
    rb = req.get("/robots.txt").text()
    check("Sitemap:" in rb and "Disallow: /compte" in rb, "robots.txt")
    home = req.get("/")
    h = home.headers
    eq(h.get("x-content-type-options"), "nosniff", "X-Content-Type-Options")
    check(h.get("x-frame-options") or "frame-ancestors" in h.get("content-security-policy", ""), "protection clickjacking")
    check("referrer-policy" in h, "Referrer-Policy")
    check("x-powered-by" not in h, "pas d'en-tête X-Powered-By")
    nf = req.get("/page-qui-n-existe-pas")
    eq(nf.status, 404, "page inconnue")
    eq(req.get("/boutique/produit-inexistant-xyz").status, 404, "produit inconnu")
    eq(req.get("/categorie/inexistante").status, 404, "catégorie inconnue")
    req.dispose()


@test("api", "accès protégés sans session (401) et redirections")
def _():
    req = api()
    for method, url in [("get", "/api/users/me"), ("get", "/api/orders"), ("get", "/api/orders/latest"), ("get", "/api/user/addresses")]:
        eq(getattr(req, method)(url).status, 401, f"{url} sans session")
    eq(req.post("/api/orders/create", data={"items": []}).status, 401, "création de commande sans session")
    eq(req.post("/api/checkout/test-payment", data={}).status, 401, "paiement sans session")
    eq(req.post("/api/checkout/bank-transfer", data={}).status, 401, "confirmation sans session")
    r = req.get("/compte", max_redirects=0)
    check(r.status in (302, 307) and "/connexion" in r.headers.get("location", ""), "middleware : /compte -> /connexion")
    eq(req.post("/api/webhooks/wordpress", data={"event": "sync.full"}).status, 401, "webhook WordPress sans secret")
    req.dispose()


@test("api", "formulaires publics : contact, devis, newsletter, ticket avec image")
def _():
    req = api()
    ok = {"name": "Client E2E", "email": "client.e2e@tatos.test", "subject": "produit", "message": "Bonjour, ce produit est-il disponible ?"}
    eq(req.post("/api/contact", data=ok).status, 201, "contact valide")
    bad = req.post("/api/contact", data={**ok, "email": "pas-un-email"})
    eq(bad.status, 400, "contact email invalide")
    eq(bad.json()["error"], "Adresse email invalide", "message d'erreur")
    eq(req.post("/api/contact", data={**ok, "subject": "inconnu"}).status, 400, "sujet invalide")
    eq(req.post("/api/contact", data="{json cassé", headers={"content-type": "application/json"}).status, 400, "JSON invalide")
    from datetime import date, timedelta

    devis = {
        "name": "Client Devis", "email": "devis@tatos.test", "phone": "06 12 34 56 78", "address": "15 Rue Paul Langevin, 93270 Sevran",
        "product": "Lave-linge LG F94N15WHS", "date": (date.today() + timedelta(days=3)).isoformat(), "timeSlot": "matin", "notes": "2e étage",
    }
    eq(req.post("/api/contact/services", data=devis).status, 201, "demande de devis d'installation")
    past = req.post("/api/contact/services", data={**devis, "date": (date.today() - timedelta(days=1)).isoformat()})
    eq((past.status, past.json()["error"]), (400, "La date ne peut pas être dans le passé"), "date passée refusée")
    eq(req.post("/api/contact/services", data={**devis, "timeSlot": "nuit"}).status, 400, "créneau inconnu refusé")
    email = f"news-{int(time.time())}@tatos.test"
    eq(req.post("/api/newsletter/subscribe", data={"email": email}).status, 201, "newsletter")
    eq(req.post("/api/newsletter/subscribe", data={"email": email.upper()}).status, 409, "newsletter doublon (casse ignorée)")
    up = req.post("/api/tickets/images", multipart={"images": {"name": "capture.png", "mimeType": "image/png", "buffer": TINY_PNG}})
    check(up.status in (200, 201), f"upload image ticket ({up.status} {up.text()[:200]})")
    images = up.json().get("images") or up.json().get("files") or []
    check(images and re.match(r"^tickets/[0-9a-f-]{36}\.png$", images[0]["url"]), f"image enregistrée sous un nom aléatoire : {up.json()}")
    fake = req.post("/api/tickets/images", multipart={"images": {"name": "x.png", "mimeType": "image/png", "buffer": b"<?php echo 1; ?>"}})
    eq(fake.status, 415, "fichier déguisé en image refusé (signature binaire)")
    t = req.post(
        "/api/tickets/create",
        data={"titre": "Bouton inactif", "description": "Le bouton ne répond pas", "type": "bug", "priorite": "normale", "email": "client.e2e@tatos.test", "images": images},
    )
    eq(t.status, 201, "création de ticket")
    check(re.match(r"^TCK-[0-9A-F]{8}$", t.json().get("ticketNumber", "")), f"numéro de ticket : {t.json()}")
    req.dispose()


@test("api", "compte : profil, carnet d'adresses, isolation entre clients")
def _():
    a, b = register_user("adr-a"), register_user("adr-b")
    ra, rb = api(a), api(b)
    eq(ra.get("/api/users/me").json()["email"], a["email"], "profil")
    addr = {"fullName": "Client A", "address": "15 Rue Paul Langevin", "city": "Sevran", "postalCode": "93270", "phone": "0612345678", "floor": 2}
    c = ra.post("/api/user/addresses", data=addr)
    check(c.status in (200, 201), f"création d'adresse ({c.status} {c.text()[:200]})")
    created = c.json().get("address") or c.json()
    aid = created["_id"]
    check(created["isDefault"], "première adresse = adresse par défaut")
    eq(ra.post("/api/user/addresses", data={**addr, "postalCode": "932"}).status, 400, "code postal invalide")
    eq(ra.put(f"/api/user/addresses/{aid}", data={**addr, "fullName": "Client A2"}).status, 200, "modification")
    eq(rb.get(f"/api/user/addresses/{aid}").status, 404, "adresse d'un autre client invisible")
    eq(rb.delete(f"/api/user/addresses/{aid}").status, 404, "suppression par un autre client refusée")
    lst = ra.get("/api/user/addresses").json()
    lst = lst.get("addresses", lst) if isinstance(lst, dict) else lst
    eq([x["fullName"] for x in lst], ["Client A2"], "liste des adresses")
    eq(ra.delete(f"/api/user/addresses/{aid}").status, 200, "suppression")
    ra.dispose()
    rb.dispose()


@test("api", "commande et paiement test : recalcul serveur, échec, succès, facture, avis, isolation")
def _():
    buyer, other = register_user("cmd"), register_user("cmd-autre")
    p = product(CHEAP)
    r = api(buyer)
    base = {"items": [{"_id": p["_id"], "quantity": 2}], "isPickupInStore": True}
    bad = r.post("/api/orders/create", data={**base, "totalAmount": 1})
    eq(bad.status, 409, "total falsifié refusé")
    expected = round(p["prix"] * 2, 2) if not p.get("promotionPrix") else round(p["promotionPrix"] * 2, 2)
    eq(bad.json()["details"]["totalAmount"], expected, "total recalculé par le serveur")
    c = r.post("/api/orders/create", data={**base, "totalAmount": expected})
    eq(c.status, 201, "création de commande")
    order = c.json()["order"]
    eq(order["status"], "EN_ATTENTE_PAIEMENT", "statut initial")
    eq(r.get("/api/orders/latest").json()["_id"], order["_id"], "commande en cours")
    intent = r.post("/api/checkout/create-payment-intent").json()
    eq((intent["provider"], intent["mode"], intent["bankTransfer"]), ("virement", "live", True), "virement bancaire proposé sans clé Stripe")
    billing = {"name": "Client Cmd", "email": buyer["email"], "address": "1 rue Test", "postalCode": "93270", "city": "Sevran", "phone": "0612345678"}
    o = api(other)
    eq(o.get(f"/api/orders/{order['_id']}").status, 404, "commande d'un autre client invisible")
    eq(o.post("/api/checkout/test-payment", data={"orderId": order["_id"], "outcome": "success", "billingAddress": billing}).status, 404, "paiement de la commande d'autrui refusé")
    fail = r.post("/api/checkout/test-payment", data={"orderId": order["_id"], "outcome": "failure", "billingAddress": billing})
    eq(fail.status, 402, "paiement refusé simulé")
    eq(r.get(f"/api/orders/{order['_id']}").json()["status"], "EN_ATTENTE_PAIEMENT", "commande toujours payable après un refus")
    ok = r.post("/api/checkout/test-payment", data={"orderId": order["_id"], "outcome": "success", "billingAddress": billing})
    eq(ok.status, 200, "paiement réussi simulé")
    eq(r.post("/api/checkout/test-payment", data={"orderId": order["_id"], "outcome": "success", "billingAddress": billing}).status, 409, "double paiement refusé")
    paid = r.get(f"/api/orders/{order['_id']}").json()
    eq((paid["status"], paid["paymentMode"]), ("PAYEE", "test"), "commande payée, mode test tracé")
    pdf = r.get(f"/api/orders/{order['_id']}/invoice")
    eq(pdf.status, 200, "facture")
    check(pdf.headers.get("content-type", "").startswith("application/pdf") and pdf.body()[:5] == b"%PDF-", "facture PDF")
    eq(o.get(f"/api/orders/{order['_id']}/invoice").status, 404, "facture d'autrui refusée")
    v = r.get(f"/api/avis/verifier?produit={p['_id']}").json()
    check(v["peutCommenter"] is True, f"avis autorisé après achat : {v}")
    eq(r.post("/api/avis", data={"produit": p["_id"], "note": 5, "commentaire": "Parfait"}).status, 201, "avis publié")
    eq(r.post("/api/avis", data={"produit": p["_id"], "note": 4, "commentaire": "Encore"}).status, 409, "un seul avis par produit")
    eq(o.post("/api/avis", data={"produit": p["_id"], "note": 1, "commentaire": "Jamais acheté"}).status, 403, "avis réservé aux acheteurs")
    loy = r.post("/api/loyalty/validate", data={"couponCode": "bienvenue10", "orderTotal": 100})
    eq(loy.status, 200, "coupon de bienvenue")
    eq(loy.json()["discount"], 10, "10 % de 100 €")
    eq(r.post("/api/loyalty/validate", data={"couponCode": "INCONNU", "orderTotal": 100}).status, 404, "coupon inconnu")
    r.dispose()
    o.dispose()


@test("api", "virement bancaire : confirmation, double envoi, facture avec coordonnées, paiement avant livraison")
def _():
    buyer, other = register_user("livr"), register_user("livr-autre")
    p = product(CHEAP)
    r, o = api(buyer), api(other)
    expected = round(p.get("promotionPrix") or p["prix"], 2)
    c = r.post("/api/orders/create", data={"items": [{"_id": p["_id"], "quantity": 1}], "isPickupInStore": True, "totalAmount": expected})
    eq(c.status, 201, "création de commande")
    order = c.json()["order"]
    check(r.post("/api/checkout/create-payment-intent").json()["bankTransfer"] is True, "virement bancaire proposé")
    billing = {"name": "Client Livr", "email": buyer["email"], "address": "1 rue Test", "postalCode": "93270", "city": "Sevran", "phone": "0612345678"}
    url = "/api/checkout/bank-transfer"
    eq(o.post(url, data={"orderId": order["_id"], "billingAddress": billing}).status, 404, "confirmation de la commande d'autrui refusée")
    eq(r.post(url, data={"orderId": order["_id"], "billingAddress": {**billing, "postalCode": "93"}}).status, 400, "adresse de facturation invalide")
    eq(r.post(url, data={"orderId": order["_id"], "billingAddress": billing}).status, 200, "commande confirmée sans paiement en ligne")
    eq(r.post(url, data={"orderId": order["_id"], "billingAddress": billing}).status, 409, "double confirmation refusée")
    got = r.get(f"/api/orders/{order['_id']}").json()
    eq((got["status"], got["paymentProvider"], got["paymentMode"], got["paidAt"]), ("EN_ATTENTE_VIREMENT", "virement", "live", None), "en attente du virement")
    pdf = r.get(f"/api/orders/{order['_id']}/invoice")
    check(pdf.status == 200 and pdf.body()[:5] == b"%PDF-", "facture (avec coordonnées de virement) disponible dès la confirmation")
    adm = ENV.pw.request.new_context(base_url=ENV.base, extra_http_headers={"Authorization": f"Bearer {ADMIN_SECRET}"})
    eq(adm.patch(f"/api/admin/orders/{order['_id']}", data={"status": "EXPEDIEE", "notify": False}).status, 409, "pas de livraison avant le virement")
    for st in ("PAYEE", "EXPEDIEE", "LIVREE"):
        eq(adm.patch(f"/api/admin/orders/{order['_id']}", data={"status": st, "notify": False}).status, 200, f"statut {st} appliqué par le magasin")
    detail = adm.get(f"/api/admin/orders/{order['_id']}").json()
    check(detail["paidAt"] and [x["status"] for x in detail["payments"] if x["provider"] == "virement"] == ["REUSSI"], "virement enregistré comme reçu")
    # Une commande en attente de virement peut aussi être annulée : le stock revient.
    c2 = r.post("/api/orders/create", data={"items": [{"_id": p["_id"], "quantity": 1}], "isPickupInStore": True, "totalAmount": expected})
    o2 = c2.json()["order"]
    eq(r.post(url, data={"orderId": o2["_id"], "billingAddress": billing}).status, 200, "seconde commande confirmée")
    stock = product(CHEAP)["stock"] if "stock" in product(CHEAP) else None
    eq(adm.patch(f"/api/admin/orders/{o2['_id']}", data={"status": "ANNULEE", "notify": False}).status, 200, "annulation par le magasin")
    if stock is not None:
        eq(product(CHEAP)["stock"], stock + 1, "article remis en stock")
    detail = adm.get(f"/api/admin/orders/{o2['_id']}").json()
    check(not detail["paidAt"] and all(x["status"] != "EN_ATTENTE" for x in detail["payments"]), "règlement prévu annulé")
    adm.dispose()
    r.dispose()
    o.dispose()


# --------------------------------------------------------------------------- parcours navigateur


@test("compte", "inscription, erreurs de formulaire, connexion, déconnexion")
def _():
    ctx = new_context()
    errors: list[str] = []
    page = new_page(ctx, errors)
    user = {"email": f"ui-{int(time.time())}@tatos.test", "password": "Parcours2026x"}
    go(page, "/inscription")
    check(page.locator('[data-cy="google-signin"]').is_visible(), "bouton Google affiché sur l'inscription")
    check(page.locator("footer").count() == 0, "pas de pied de page sur l'inscription")
    # Erreurs par champ : formulaire vide, puis saisies incorrectes, chaque message sous son champ.
    page.locator('[data-cy="signup-submit"]:visible').click()
    page.locator("#email-error", has_text="Saisissez votre adresse email.").wait_for()
    page.locator("#mdp-error", has_text="Choisissez un mot de passe.").wait_for()
    check(page.evaluate("document.activeElement.id") == "email", "focus placé sur le premier champ en erreur")
    page.locator('[data-cy="signup-email-input"]:visible').fill("pas-un-email")
    page.locator('[data-cy="signup-password-input"]:visible').fill("abc")
    page.locator('[data-cy="signup-submit"]:visible').click()
    page.locator("#email-error", has_text="nom@exemple.fr").wait_for()
    page.locator("#mdp-error", has_text="Mot de passe trop faible").wait_for()
    page.locator('[data-cy="signup-email-input"]:visible').fill(user["email"])
    check(page.locator("#email-error").count() == 0, "l'erreur disparaît dès que la saisie est correcte")
    page.locator('[data-cy="signup-password-input"]:visible').fill(user["password"])
    page.locator('[data-cy="signup-confirm-password-input"]:visible').fill("Different2026x")
    page.locator('[data-cy="signup-submit"]:visible').click()
    page.locator("#mdpv-error", has_text="ne sont pas identiques").wait_for()
    page.locator('[data-cy="signup-confirm-password-input"]:visible').fill(user["password"])
    page.locator('[data-cy="signup-submit"]:visible').click()
    page.wait_for_url("**/compte", timeout=30_000)
    page.get_by_text(user["email"]).first.wait_for()
    # Déconnexion puis mauvaise / bonne connexion.
    ctx.clear_cookies()
    go(page, "/connexion")
    page.locator('[data-cy="email-input"]:visible').fill(user["email"])
    page.locator('[data-cy="password-input"]:visible').fill("MauvaisMotDePasse1")
    page.locator('[data-cy="login-submit"]:visible').click()
    page.get_by_text("Email ou mot de passe incorrect.").first.wait_for()
    ui_login(page, user)
    page.get_by_text(user["email"]).first.wait_for()
    # Une page protégée ouverte sans session renvoie vers la connexion avec retour prévu.
    ctx.clear_cookies()
    page.goto("/compte/commandes")
    page.wait_for_url(re.compile(r"/connexion\?callbackUrl="))
    check(not errors, f"erreurs pendant le parcours : {errors}")
    ctx.close()


@test("compte", "mot de passe oublié : email (outbox), lien à usage unique, nouvelle connexion")
def _():
    user = register_user("reset")
    ctx = new_context()
    page = new_page(ctx)
    go(page, "/connexion/mot-de-passe-oublie")
    page.locator("#email").fill(user["email"])
    page.get_by_role("button", name=re.compile("Envoyer|Réinitialiser|lien", re.I)).click()
    page.get_by_text(re.compile("email de réinitialisation a été envoyé")).first.wait_for()
    token = None
    for _ in range(20):
        token = outbox_reset_token()
        if token:
            break
        page.wait_for_timeout(250)
    check(token, "email de réinitialisation écrit dans l'outbox")
    go(page, f"/connexion/reinitialiser?token={token}")
    new_password = "NouveauMdp2026"
    page.locator("#mdp").fill(new_password)
    page.locator("#mdpv").fill(new_password)
    page.locator('main form button[type="submit"]').click()
    page.get_by_text("Votre mot de passe a été modifié").first.wait_for()
    page.wait_for_url("**/connexion")
    ui_login(page, {**user, "password": new_password})
    reuse = api().post("/api/auth/reset-password", data={"token": token, "mdp": "EncoreUn2026"})
    eq(reuse.status, 400, "lien déjà utilisé")
    ctx.close()


@test("achat", "client connecté : livraison, virement bancaire, confirmation, commandes")
def _():
    errors: list[str] = []
    ctx = new_context(consent="accepted")
    page = new_page(ctx, errors)
    ui_login(page, ENV.demo, callback="/compte")
    add_to_cart(page, CHEAP, quantity=2)
    open_cart(page)
    total = page.get_by_test_id("cart-total").inner_text()
    # Plus de retrait en magasin : livraison seulement (adresse via la Base Adresse Nationale).
    check(page.get_by_text("Retrait en magasin", exact=True).count() == 0, "retrait en magasin non proposé")
    page.locator("#ship-fullName").fill("Client Démo")
    page.locator("#ship-phone").fill("0612345678")
    page.locator("#ship-address").fill(STORE_ADDRESS)
    try:
        page.get_by_role("option").first.wait_for(timeout=15_000)
    except Exception:
        raise Skip("API Base Adresse Nationale injoignable depuis cet environnement")
    page.get_by_role("option").filter(has_text="Sevran").first.click()
    page.get_by_text("Adresse de livraison complète", exact=True).wait_for(timeout=20_000)
    page.get_by_role("radiogroup", name="Options de livraison").wait_for(timeout=20_000)
    page.locator("#termsCheckbox").check(force=True)
    page.get_by_test_id("checkout-button").click()
    page.wait_for_url("**/paiement", timeout=30_000)
    page.get_by_test_id("bank-transfer").wait_for()
    check(page.get_by_text(re.compile("mode test|simuler", re.I)).count() == 0, "aucune mention de test sur la page de paiement")
    page.get_by_text("Paiement par virement bancaire, avant livraison", exact=False).wait_for()
    # Formats d'origine différents (« 40 € » au panier, « 40.00€ » au paiement) : on compare les montants.
    amount = lambda t: float(re.sub(r"[^\d,.]", "", t).replace(",", "."))
    eq(amount(page.get_by_test_id("payment-total").inner_text()), amount(total), "total identique panier / paiement")
    for label, value in [("Nom complet", "Client Démo"), ("Adresse", "15 Rue Paul Langevin"), ("Code postal", "93270"), ("Ville", "Sevran"), ("Téléphone", "0612345678")]:
        field = page.get_by_label(label, exact=True)
        if not field.input_value():
            field.fill(value)
    page.get_by_test_id("bank-transfer").click()
    page.wait_for_url(re.compile(r"/confirmation\?status=success&order="), timeout=30_000)
    page.get_by_text("Merci pour votre commande !").wait_for()
    check("par virement bancaire" in page.locator("main").inner_text(), "virement bancaire annoncé")
    check(page.get_by_test_id("transfer-details").count() == 1, "montant et référence du virement affichés")
    check(page.get_by_role("link", name=re.compile("Continuer mes achats", re.I)).count() == 0, "plus de bouton « Continuer mes achats »")
    number = re.search(r"TAT-\d{8}-[0-9A-F]{6}", page.content()).group(0)
    go(page, "/compte/commandes")
    page.get_by_text(f"Commande {number}").wait_for()
    row = page.locator("article").filter(has=page.get_by_role("heading", name=f"Commande {number}"))
    # Le libellé est affiché en capitales (CSS) : comparaison sans casse.
    text = row.inner_text().lower()
    check("en attente de virement" in text and "à régler par virement" in text, "commande en attente de virement")
    check("télécharger la facture" in text, "facture disponible dans l'espace client")
    order_id = re.search(r"order=([A-Za-z0-9]+)", page.evaluate("document.referrer") or "") or None
    resp = page.request.get("/api/orders")
    orders = resp.json()
    orders = orders.get("orders", orders) if isinstance(orders, dict) else orders
    mine = next(o for o in orders if o["number"] == number)
    eq(page.request.get(f"/api/orders/{mine['_id']}/invoice").status, 200, "facture avec coordonnées de virement")
    # Le panier est vidé après paiement.
    page.goto("/panier")
    page.locator("main").get_by_text("Votre panier est vide").wait_for()
    check(not errors, f"erreurs pendant le parcours : {errors}")
    del order_id
    ctx.close()


@test("achat", "livraison à domicile sans compte : autocomplétion BAN, livraison offerte, compte créé avant le paiement")
def _():
    errors: list[str] = []
    ctx = new_context(consent="accepted")
    page = new_page(ctx, errors)
    # Visiteur sans compte : il prépare toute sa commande, le compte n'est demandé qu'au paiement.
    add_to_cart(page, CHEAP)
    go(page, "/panier")
    # Livraison à domicile seule proposée (plus de retrait en magasin).
    page.get_by_text("Livraison à domicile, offerte", exact=True).wait_for()
    page.locator("#ship-fullName").fill("Client Livraison")
    page.locator("#ship-phone").fill("0612345678")
    page.locator("#ship-address").fill(STORE_ADDRESS)
    try:
        page.get_by_role("option").first.wait_for(timeout=15_000)
    except Exception:
        raise Skip("API Base Adresse Nationale injoignable depuis cet environnement")
    page.get_by_role("option").filter(has_text="Sevran").first.click()
    eq(page.locator("#ship-postalCode").input_value(), "93270", "code postal rempli par l'autocomplétion")
    eq(page.locator("#ship-city").input_value(), "Sevran", "ville remplie par l'autocomplétion")
    page.locator("#ship-floor").select_option("4")
    page.get_by_text("Adresse de livraison complète", exact=True).wait_for(timeout=20_000)
    group = page.get_by_role("radiogroup", name="Options de livraison")
    group.wait_for(timeout=20_000)
    text = group.inner_text()
    check(text.count("Offert") == 3 and "€" not in text, f"trois modes de livraison offerts : {text!r}")
    group.get_by_text("Installation", exact=True).click()
    page.locator("#termsCheckbox").check(force=True)
    page.get_by_test_id("checkout-button").click()
    # Panneau « Dernière étape : votre compte » : création du compte sans quitter le panier.
    panel = page.get_by_role("dialog", name="Dernière étape : votre compte")
    panel.wait_for(timeout=10_000)
    check(page.url.endswith("/panier"), "toujours sur le panier")
    password = f"Essai{int(time.time())}2026x"
    panel.locator('[data-cy="signup-email-input"]').fill(f"invite-{int(time.time())}@tatos.test")
    panel.locator('[data-cy="signup-password-input"]').fill(password)
    panel.locator('[data-cy="signup-confirm-password-input"]').fill(password)
    panel.locator('[data-cy="signup-submit"]').click()
    page.wait_for_url("**/paiement", timeout=30_000)
    latest = page.request.get("/api/orders/latest").json()
    eq((latest["deliveryMethod"], latest["deliveryFee"], latest["isPickupInStore"]), ("installation", 0, False), "livraison offerte, recalculée par le serveur")
    check(latest["deliveryDistance"] <= 2, f"distance magasin calculée côté serveur : {latest['deliveryDistance']} km")
    check(not errors, f"erreurs pendant le parcours : {errors}")
    ctx.close()


@test("achat", "panier : persistance selon le consentement cookies, quantités, vidage")
def _():
    for consent, persisted in [("accepted", True), ("rejected", True)]:
        ctx = new_context(consent=consent)
        page = new_page(ctx)
        add_to_cart(page, CHEAP)
        # Navigation côté client (clic sur l'icône) : le panier en mémoire est conservé dans tous les cas.
        open_cart(page)
        page.get_by_test_id("cart-total").wait_for()
        page.reload()
        wait_hydrated(page)
        page.wait_for_timeout(800)
        empty = page.locator("main").get_by_text("Votre panier est vide").count() > 0
        eq(not empty, persisted, f"panier conservé après rechargement (cookies {consent})")
        ctx.close()
    ctx = new_context(consent="accepted")
    page = new_page(ctx)
    add_to_cart(page, CHEAP)
    go(page, "/panier")
    page.get_by_role("button", name=re.compile("Vider le panier")).click()
    page.get_by_role("button", name="Oui, vider").click()
    page.locator("main").get_by_text("Votre panier est vide").wait_for()
    ctx.close()


@test("navigation", "recherche, filtres boutique, pagination, fiche produit")
def _():
    errors: list[str] = []
    ctx = new_context()
    page = new_page(ctx, errors)
    go(page, "/")
    search = page.get_by_role("searchbox").or_(page.get_by_placeholder(re.compile("Rechercher", re.I))).first
    if not search.is_visible():
        page.get_by_role("button", name="Rechercher").first.click()
    search.fill("TWC01")
    link = page.locator(f'a[href="/boutique/{CHEAP}"]').first
    link.wait_for(timeout=15_000)
    link.click()
    page.wait_for_url(f"**/boutique/{CHEAP}")
    page.get_by_role("heading", level=1).wait_for()
    page.goto("/boutique?categorie=lave-linge")
    cards = page.locator('a[href^="/boutique/"]')
    cards.first.wait_for()
    first_page = cards.evaluate_all("els => [...new Set(els.map(e => e.getAttribute('href')))]")
    check(len(first_page) >= 6, f"produits lave-linge listés : {len(first_page)}")
    page.goto("/boutique?categorie=lave-linge&page=2")
    cards.first.wait_for()
    second = cards.evaluate_all("els => [...new Set(els.map(e => e.getAttribute('href')))]")
    check(set(second) != set(first_page), "la page 2 affiche d'autres produits")
    check(not errors, f"erreurs : {errors}")
    ctx.close()


@test("formulaires", "contact, newsletter et signalement de bug (avec capture) via l'interface")
def _():
    errors: list[str] = []
    ctx = new_context()
    page = new_page(ctx, errors)
    go(page, "/contact")
    form = page.locator("form").filter(has=page.locator("textarea")).first
    form.locator('input[name="name"], #name').first.fill("Client Formulaire")
    form.locator('input[type="email"]').first.fill("formulaire@tatos.test")
    form.locator("select").select_option("produit")
    form.locator("textarea").first.fill("Message de test du formulaire de contact.")
    form.get_by_role("button", name=re.compile("Envoyer", re.I)).click()
    page.get_by_text(re.compile("envoyé avec succès", re.I)).first.wait_for()

    go(page, "/promotions")
    nl = page.locator("form").filter(has=page.locator('input[type="email"]')).last
    nl.locator('input[type="email"]').fill(f"nl-{int(time.time())}@tatos.test")
    nl.get_by_role("button").first.click()
    page.get_by_text(re.compile("Inscription réussie", re.I)).first.wait_for()

    go(page, "/signaler-bug")
    page.locator("#titre").fill("Affichage décalé")
    page.locator("#description").fill("Le bloc se décale sur mobile.")
    page.locator("#email").fill("bug@tatos.test")
    page.locator('input[type="file"]').set_input_files({"name": "capture.png", "mimeType": "image/png", "buffer": TINY_PNG})
    page.get_by_role("button", name=re.compile("Envoyer|Signaler|Soumettre", re.I)).last.click()
    page.get_by_text(re.compile(r"TCK-[0-9A-F]{8}|ticket.*(créé|envoyé|enregistré)", re.I)).first.wait_for(timeout=20_000)
    check(not errors, f"erreurs : {errors}")
    ctx.close()


# --------------------------------------------------------------------------- responsive


def responsive_test(vp_name: str):
    def run():
        w, h = VIEWPORTS[vp_name]
        mobile = w < 768
        ctx = new_context(viewport=(w, h), is_mobile=mobile, has_touch=mobile)
        problems: list[str] = []
        shots = OUT / "responsive" / vp_name
        shots.mkdir(parents=True, exist_ok=True)
        for route in RESPONSIVE_ROUTES:
            errors: list[str] = []
            page = new_page(ctx, errors)
            resp = page.goto(route, wait_until="load")
            page.wait_for_timeout(600)
            status = resp.status if resp else 0
            if status != 200:
                problems.append(f"{route}: HTTP {status}")
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            if overflow > 1:
                culprits = page.evaluate(
                    """() => [...document.querySelectorAll('body *')].filter(e => {
                        const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed';
                    }).slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 60))"""
                )
                problems.append(f"{route}: débordement horizontal de {overflow}px ({culprits})")
            if w < 1024:
                toggle = page.get_by_role("button", name="Ouvrir le menu")
                if not toggle.is_visible():
                    problems.append(f"{route}: bouton de menu mobile invisible")
                elif route == "/":
                    toggle.click()
                    page.wait_for_timeout(400)
                    menu = page.locator("#menu-mobile")
                    if not menu.get_by_role("link", name="Boutique").is_visible():
                        problems.append("menu mobile : lien Boutique invisible après ouverture")
                    page.get_by_role("button", name="Fermer le menu").click()
            else:
                if not page.locator('nav [data-cy="nav-boutique"]').first.is_visible():
                    problems.append(f"{route}: navigation principale invisible")
            name = route.strip("/").replace("/", "__") or "accueil"
            page.screenshot(path=str(shots / f"{name}.png"))
            problems.extend(f"{route}: {e}" for e in errors)
            page.close()
        ctx.close()
        check(not problems, "\n    " + "\n    ".join(problems))

    return run


for _vp in VIEWPORTS:
    test("responsive", f"{_vp} : {len(RESPONSIVE_ROUTES)} pages (HTTP 200, aucun débordement, menu, console propre)")(responsive_test(_vp))

# --------------------------------------------------------------------------- exécution


def node() -> str:
    return shutil.which("node") or "node"


def prepare_db():
    db = ROOT / "prisma" / "e2e.db"
    for f in (db, Path(f"{db}-journal")):
        f.unlink(missing_ok=True)
    env = {**os.environ, "DATABASE_URL": "file:./e2e.db"}
    subprocess.run([node(), str(ROOT / "node_modules/prisma/build/index.js"), "migrate", "deploy"], cwd=ROOT, env=env, check=True, capture_output=True)
    subprocess.run([node(), str(ROOT / "node_modules/tsx/dist/cli.mjs"), "prisma/seed.ts"], cwd=ROOT, env=env, check=True, capture_output=True)


# Clé de l'API d'administration du serveur de test (celle de l'environnement avec --no-server).
ADMIN_SECRET = os.environ.get("ADMIN_API_SECRET") or f"e2e-{os.urandom(8).hex()}"


def start_server(port: int):
    env = {
        **os.environ,
        "DATABASE_URL": "file:./e2e.db",
        "NEXTAUTH_URL": f"http://localhost:{port}",
        "MAIL_OUTBOX_DIR": str(OUT / "outbox"),
        "UPLOAD_DIR": str(OUT / "uploads"),
        "STRIPE_SECRET_KEY": "",
        # Simulation de paiement réservée aux tests (échec / succès), jamais active en production.
        "TEST_PAYMENTS": "true",
        # Commandes de test par l'API en retrait (sans géocodage) ; fermé sur le site en production.
        "STORE_PICKUP_ENABLED": "true",
        "ADMIN_API_SECRET": ADMIN_SECRET,
        "NODE_ENV": "production",
    }
    log = open(OUT / "server.log", "w", encoding="utf-8")
    proc = subprocess.Popen([node(), str(ROOT / "node_modules/next/dist/bin/next"), "start", "-p", str(port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/robots.txt", timeout=3) as r:
                if r.status == 200:
                    return proc
        except Exception:
            time.sleep(0.5)
        if proc.poll() is not None:
            raise RuntimeError(f"le serveur s'est arrêté (voir {OUT / 'server.log'})")
    raise RuntimeError("le serveur n'a pas démarré en 120 s")


def stop_server(proc):
    if proc and proc.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        else:
            proc.terminate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:3100")
    ap.add_argument("--no-server", action="store_true", help="utiliser un serveur déjà démarré")
    ap.add_argument("--only", default="", help="groupes ou fragments de nom, séparés par des virgules")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    ENV.base = args.base_url.rstrip("/")
    ENV.demo = json.loads((ROOT / "data/seed/demo-accounts.json").read_text(encoding="utf-8"))["customer"]
    proc = None
    if not args.no_server:
        print("Préparation de prisma/e2e.db (migrations + seed)…", flush=True)
        prepare_db()
        port = urlparse(ENV.base).port or 3100
        print(f"Démarrage de `next start` sur :{port}…", flush=True)
        proc = start_server(port)
    filters = [f.strip().lower() for f in args.only.split(",") if f.strip()]
    selected = [t for t in TESTS if not filters or any(f in t[0].lower() or f in t[1].lower() for f in filters)]
    started = time.time()
    try:
        with sync_playwright() as pw:
            ENV.pw = pw
            ENV.browser = pw.chromium.launch(headless=not args.headed)
            for group, name, fn in selected:
                t0 = time.time()
                status, detail = "OK", ""
                try:
                    fn()
                except Skip as e:
                    status, detail = "IGNORÉ", str(e)
                except Exception as e:  # noqa: BLE001
                    status = "ÉCHEC"
                    detail = f"{type(e).__name__}: {e}" if isinstance(e, AssertionError) else traceback.format_exc(limit=3)
                    for ctx in ENV.browser.contexts:
                        for i, pg in enumerate(ctx.pages):
                            try:
                                pg.screenshot(path=str(OUT / f"echec-{len(RESULTS)}-{i}.png"), full_page=True)
                            except Exception:
                                pass
                        ctx.close()
                dt = time.time() - t0
                RESULTS.append({"groupe": group, "test": name, "statut": status, "duree_s": round(dt, 1), "detail": detail})
                print(f"[{status:^7}] {group:<12} {name} ({dt:.1f}s)" + (f"\n          {detail.strip()[:1500]}" if detail else ""), flush=True)
            ENV.browser.close()
    finally:
        stop_server(proc)

    external = {h: n for h, n in REQUEST_HOSTS.items() if not h.startswith(("localhost", "127.0.0.1"))}
    summary = {
        "base_url": ENV.base,
        "duree_s": round(time.time() - started, 1),
        "total": len(RESULTS),
        "ok": sum(r["statut"] == "OK" for r in RESULTS),
        "echecs": sum(r["statut"] == "ÉCHEC" for r in RESULTS),
        "ignores": sum(r["statut"] == "IGNORÉ" for r in RESULTS),
        "requetes_vers_la_source": SOURCE_REQUESTS,
        "hotes_externes_contactes": external,
        "resultats": RESULTS,
    }
    (OUT / "report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{summary['ok']}/{summary['total']} réussis, {summary['echecs']} échec(s), {summary['ignores']} ignoré(s) en {summary['duree_s']} s")
    print(f"Requêtes réseau vers le site source : {len(SOURCE_REQUESTS)}")
    print(f"Hôtes externes contactés par le navigateur : {external or 'aucun'}")
    sys.exit(1 if summary["echecs"] or SOURCE_REQUESTS else 0)


if __name__ == "__main__":
    main()
