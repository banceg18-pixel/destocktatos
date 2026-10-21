"""
Recette de l'espace d'administration WordPress, de bout en bout (navigateur réel + site réel).

Prérequis : site démarré (http://localhost:3000, CMS_PROVIDER=wordpress) et WordPress local démarré
(http://localhost:8080, plugin TATOS Headless lié au site). Identifiants admin lus dans
wordpress/.local/admin-credentials.txt (installation locale de test).

    python tests/e2e/wordpress_admin.py

Chaque modification faite pour le test est annulée à la fin (page d'accueil, produit, stock…).
"""
from __future__ import annotations

import json
import os
import random
import re
import subprocess
import sys
import time
import traceback
from urllib.parse import quote
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
SITE, WP = "http://localhost:3000", "http://localhost:8080"
OUTBOX = ROOT / "outbox"
ENV = dict(l.split("=", 1) for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines() if "=" in l and not l.startswith("#"))
ADMIN_KEY = ENV.get("ADMIN_API_SECRET", "").strip()
creds = (ROOT / "wordpress/.local/admin-credentials.txt").read_text(encoding="utf-8")
WP_USER = re.search(r"Identifiant\s*:\s*(\S+)", creds).group(1)
WP_PASS = re.search(r"Mot de passe\s*:\s*(\S+)", creds).group(1)
RESULTS: list[tuple[bool, str]] = []
JS_ERRORS: list[str] = []


def check(cond, label):
    RESULTS.append((bool(cond), label))
    print(f"[{'  OK  ' if cond else 'ÉCHEC '}] {label}")
    return cond


def wait_until(fn, timeout=40, every=1.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            v = fn()
            if v:
                return v
        except Exception:  # noqa: BLE001
            pass
        time.sleep(every)
    return None


def newest_outbox(tag: str, since: float):
    files = [f for f in OUTBOX.glob(f"*-{tag}.json") if f.stat().st_mtime >= since]
    return json.loads(max(files, key=lambda f: f.stat().st_mtime).read_text(encoding="utf-8")) if files else None


def notice(page: Page) -> str:
    n = page.locator(".notice-success, .notice-error, #message").first
    n.wait_for(timeout=20_000)
    return n.inner_text()


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ip = f"10.77.{random.randint(1, 250)}.{random.randint(1, 250)}"
        site = pw.request.new_context(base_url=SITE, extra_http_headers={"x-forwarded-for": ip})
        admin_api = pw.request.new_context(base_url=SITE, extra_http_headers={"Authorization": f"Bearer {ADMIN_KEY}"})
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, locale="fr-FR")
        page = ctx.new_page()
        # Le serveur PHP intégré traite une requête à la fois : pages d'administration lentes à charger.
        page.set_default_timeout(90_000)
        page.set_default_navigation_timeout(120_000)
        page.on("pageerror", lambda e: JS_ERRORS.append(f"{page.url}: {e}"))
        page.on("dialog", lambda d: d.accept())

        # ---------------------------------------------------------------- Connexion et tableau de bord
        page.goto(f"{WP}/wp-login.php")
        page.fill("#user_login", WP_USER)
        page.fill("#user_pass", WP_PASS)
        page.click("#wp-submit")
        page.wait_for_url(re.compile(r"/wp-admin/"), wait_until="domcontentloaded")
        check("wp-admin" in page.url, "connexion à l'administration WordPress")
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-boutique")
        check(page.locator(".tatos-kpi").count() == 7 and page.locator(".notice-error").count() == 0, "Boutique : tableau de bord alimenté par le site (7 indicateurs)")
        page.goto(f"{WP}/wp-admin/options-general.php?page=tatos-headless&tatos_check=1")
        check("Liaison réussie" in page.locator(".notice").first.inner_text(), "Réglages : liaison avec le site vérifiée")
        page.goto(f"{WP}/wp-admin/")
        page.locator("#tatos_dashboard").wait_for()
        check(page.locator("#tatos_dashboard .tatos-kpi").count() == 7, "accueil WordPress : widget « Boutique — activité »")
        check(page.request.get(f"{WP}/", max_redirects=0).headers.get("location", "").startswith(SITE), "WordPress public redirigé vers le site")

        # ---------------------------------------------------------------- Page d'accueil du site
        home_id = json.loads(page.evaluate("fetch('/wp-json/wp/v2/pages?slug=accueil&_fields=id').then(r => r.text())"))[0]["id"]
        page.goto(f"{WP}/wp-admin/post.php?post={home_id}&action=edit")
        field = page.locator('input[name="tatos_data[hero][slides][0][title]"]')
        original_title = field.input_value()
        marker = f"Titre modifié depuis WordPress {random.randint(1000, 9999)}"
        field.fill(marker)
        page.click("#publish")
        check("mise à jour" in notice(page).lower(), "accueil : contenu enregistré dans WordPress")
        check(wait_until(lambda: marker in site.get("/").text()), "accueil : nouveau titre visible sur le site")
        page.goto(f"{WP}/wp-admin/post.php?post={home_id}&action=edit")
        page.locator('input[name="tatos_data[hero][slides][0][title]"]').fill(original_title)
        page.click("#publish")
        notice(page)
        check(wait_until(lambda: original_title in site.get("/").text() and marker not in site.get("/").text()), "accueil : titre d'origine restauré")

        # ---------------------------------------------------------------- Article
        title = f"Article de recette {random.randint(1000, 9999)}"
        page.goto(f"{WP}/wp-admin/post-new.php")
        page.locator('iframe[name="editor-canvas"]').wait_for(timeout=30_000)
        page.wait_for_timeout(1500)
        if page.locator(".components-modal__screen-overlay").count():
            page.keyboard.press("Escape")  # guide de bienvenue de l'éditeur
            page.locator(".components-modal__screen-overlay").wait_for(state="detached", timeout=10_000)
        canvas = page.frame_locator('iframe[name="editor-canvas"]')
        title_box = canvas.get_by_role("textbox", name=re.compile("titre|title", re.I)).first
        title_box.click()
        title_box.type(title)
        page.keyboard.press("Enter")
        page.keyboard.type("Paragraphe rédigé dans l'éditeur WordPress pour vérifier la publication sur le site.")
        page.locator(".editor-post-publish-panel__toggle, .editor-post-publish-button__button").first.click()
        page.locator(".editor-post-publish-panel .editor-post-publish-button, .editor-post-publish-panel__header-publish-button button").first.click()
        page.locator(".post-publish-panel__postpublish, .components-snackbar").first.wait_for(timeout=30_000)
        post = json.loads(page.evaluate(f"fetch('/wp-json/wp/v2/posts?search={title.replace(' ', '%20')}&_fields=id,slug').then(r => r.text())"))[0]
        check(wait_until(lambda: site.get(f"/conseils/{post['slug']}").status == 200 and title in site.get(f"/conseils/{post['slug']}").text()), "article : publié dans WordPress, en ligne sur /conseils")
        check(wait_until(lambda: title in site.get("/conseils").text()), "article : présent dans la liste des conseils")
        page.evaluate(f"fetch('/wp-json/wp/v2/posts/{post['id']}?force=true', {{method: 'DELETE', headers: {{'X-WP-Nonce': wpApiSettings.nonce}}}})")
        check(wait_until(lambda: site.get(f"/conseils/{post['slug']}").status == 404, timeout=60), "article : supprimé dans WordPress, retiré du site")

        # ---------------------------------------------------------------- Produit : prix et stock
        prod = site.get("/api/produits?limit=1&tri=prix-asc").json()["produits"][0]
        wp_prod = json.loads(page.evaluate(f"fetch('/wp-json/wp/v2/produits?slug={prod['slug'][:190]}&_fields=id').then(r => r.text())"))
        if not wp_prod:
            wp_prod = [{"id": int(re.sub(r"^wp0*", "", prod["_id"]))}] if prod["_id"].startswith("wp") else []
        check(wp_prod, "produit : retrouvé dans WordPress")
        live = admin_api.get(f"/api/admin/products/{prod['_id']}").json()
        page.goto(f"{WP}/wp-admin/post.php?post={wp_prod[0]['id']}&action=edit")
        check(page.locator("#tatos-stock").input_value() == str(live["stock"]), "produit : stock réel du site affiché dans la fiche")
        promo_field = page.locator('input[name="tatos_product[promotion_prix]"]')
        old_promo = promo_field.input_value()
        new_promo = round(prod["prix"] * 0.9, 2)
        promo_field.fill(f"{new_promo:.2f}".replace(".", ","))
        page.fill("#tatos-stock", str(live["stock"] + 3))
        page.click("#publish")
        notice(page)
        def promo_on_site():
            # Recherche par référence, ou par titre quand le produit n'en a pas.
            items = admin_api.get(f"/api/admin/products?q={quote(prod.get('modele') or prod['titre'])}&per=50").json()["items"]
            mine = next((i for i in items if i["id"] == prod["_id"]), None)
            return mine and abs((mine["promotionPrixCents"] or 0) / 100 - new_promo) < 0.01

        check(wait_until(promo_on_site), "produit : prix promotionnel modifié dans WordPress, appliqué sur le site")
        check(wait_until(lambda: admin_api.get(f"/api/admin/products/{prod['_id']}").json()["stock"] == live["stock"] + 3), "produit : stock modifié dans WordPress, appliqué sur le site")
        page.goto(f"{WP}/wp-admin/post.php?post={wp_prod[0]['id']}&action=edit")
        page.locator('input[name="tatos_product[promotion_prix]"]').fill(old_promo)
        page.fill("#tatos-stock", str(live["stock"]))
        page.click("#publish")
        notice(page)
        check(wait_until(lambda: admin_api.get(f"/api/admin/products/{prod['_id']}").json()["stock"] == live["stock"]), "produit : valeurs d'origine restaurées")

        # ---------------------------------------------------------------- Stock (écran Boutique → Stock)
        # Recherche par référence, ou par titre quand le produit n'en a pas.
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-stock&q={quote(prod.get('modele') or prod['titre'])}")
        row_form = page.locator("form.tatos-inline").filter(has=page.locator(f'input[name="product"][value="{prod["_id"]}"]')).first
        row_form.locator('input[name="stock"]').fill(str(live["stock"] + 1))
        row_form.locator("button").click()
        check("Stock enregistré" in notice(page), "stock : correction depuis l'écran Stock")
        check(admin_api.get(f"/api/admin/products/{prod['_id']}").json()["stock"] == live["stock"] + 1, "stock : valeur appliquée sur le site")
        admin_api.patch(f"/api/admin/products/{prod['_id']}", data={"stock": live["stock"]})

        # ---------------------------------------------------------------- Commande : client réel puis gestion
        email = f"wp-admin-{int(time.time())}@tatos.test"
        check(site.post("/api/auth/register", data={"email": email, "mdp": "Recette2026", "mdpv": "Recette2026"}).status == 201, "client : inscription sur le site")
        csrf = site.get("/api/auth/csrf").json()["csrfToken"]
        site.post("/api/auth/callback/credentials", form={"csrfToken": csrf, "email": email, "mdp": "Recette2026", "json": "true"})
        cheap = site.get("/api/produits?limit=1&tri=prix-asc").json()["produits"][0]
        price = cheap.get("promotionPrix") or cheap["prix"]
        # Livraison à domicile (offerte) : le retrait en magasin n'est plus proposé.
        ship = {"fullName": "Recette WP", "address": "15 Rue Paul Langevin", "city": "Sevran", "postalCode": "93270", "phone": "0612345678", "additionalInfo": "", "floor": 0}
        order = site.post("/api/orders/create", data={"items": [{"_id": cheap["_id"], "quantity": 1}], "isPickupInStore": False, "deliveryMethod": "piedDuCamion", "includeOldItemPickup": False, "shippingAddress": ship, "totalAmount": price}).json()["order"]
        t0 = time.time() - 1
        confirmed = site.post("/api/checkout/bank-transfer", data={"orderId": order["_id"], "billingAddress": {"name": "Recette WP", "email": email, "address": "1 rue Test", "postalCode": "93270", "city": "Sevran", "phone": "0612345678"}})
        check(confirmed.status == 200, "commande : confirmée sur le site, règlement par virement")
        check(wait_until(lambda: newest_outbox("commande-confirmation", t0), timeout=15), "commande : email de confirmation au client")
        check(wait_until(lambda: newest_outbox("commande-magasin", t0), timeout=15), "commande : alerte « nouvelle commande » au magasin")
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-orders")
        check(page.locator("tr", has_text=order["number"]).get_by_text("virement attendu").count() == 1, "commande : repérée « virement attendu » dans la liste")
        page.get_by_role("link", name=order["number"]).first.click()
        check(page.locator("h1").inner_text().startswith(f"Commande {order['number']}"), "commande : visible et détaillée dans WordPress")
        check("virement attendu de" in page.locator("#wpbody-content").inner_text(), "commande : virement attendu affiché")
        check(page.locator("a", has_text="Ouvrir la facture PDF").count() == 1, "commande : facture (avec coordonnées bancaires) dès la confirmation")
        page.select_option('select[name="status"]', "PAYEE")
        page.locator("form.tatos-confirm-cancel button").click()
        check("Payée (virement reçu)" in notice(page), "commande : virement marqué reçu")
        check(site.get(f"/api/orders/{order['_id']}").json()["paidAt"], "commande : paiement enregistré sur le site")
        page.select_option('select[name="status"]', "EXPEDIEE")
        t1 = time.time() - 1
        page.locator("form.tatos-confirm-cancel button").click()
        check("Statut mis à jour" in notice(page), "commande : statut « Expédiée » appliqué")
        check(wait_until(lambda: newest_outbox("commande-expediee", t1), timeout=15), "commande : client prévenu par email")
        check(site.get(f"/api/orders/{order['_id']}").json()["status"] == "EXPEDIEE", "commande : statut visible dans l'espace client")
        page.select_option('select[name="status"]', "LIVREE")
        page.locator("form.tatos-confirm-cancel button").click()
        check("Statut mis à jour" in notice(page), "commande : livrée")
        pdf = page.request.get(page.locator("a", has_text="Ouvrir la facture PDF").get_attribute("href"))
        check(pdf.status == 200 and pdf.body()[:4] == b"%PDF", "commande : facture PDF ouverte depuis WordPress")
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-customers&q={email}")
        check(page.get_by_text(email).count() > 0, "clients : nouveau client listé")

        # ---------------------------------------------------------------- Code promo
        code = f"RECETTE{random.randint(100, 999)}"
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-coupons")
        page.fill('input[name="code"]', code)
        page.fill('input[name="value"]', "5")
        page.locator('form button.button-primary').click()
        check("enregistré" in notice(page), "codes promo : création depuis WordPress")
        v = site.post("/api/loyalty/validate", data={"couponCode": code, "orderTotal": 200})
        check(v.status == 200 and abs(v.json()["discount"] - 10) < 0.01, "codes promo : code utilisable sur le site (−5 % sur 200 €)")
        page.locator("tr", has_text=code).locator("form.tatos-confirm button").click()
        check("supprimé" in notice(page).lower(), "codes promo : suppression")

        # ---------------------------------------------------------------- Messages
        subject_name = f"Client Recette {random.randint(100, 999)}"
        site.post("/api/contact", data={"name": subject_name, "email": email, "subject": "produit", "message": "Bonjour, ce lave-linge existe-t-il en blanc ?"})
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-messages&kind=contact")
        card = page.locator(".tatos-message", has_text=subject_name).first
        check(card.count() == 1, "messages : message de contact reçu dans WordPress")
        card.locator("summary").click()
        card.locator('textarea[name="text"]').fill("Bonjour, oui, il existe en blanc. Bonne journée.")
        t2 = time.time() - 1
        card.locator("form button.button-primary").click()
        notice(page)
        check(wait_until(lambda: newest_outbox("reponse-contact", t2), timeout=15), "messages : réponse envoyée au client par email")

        # ---------------------------------------------------------------- Newsletter
        sub = f"nl-wp-{int(time.time())}@tatos.test"
        t3 = time.time() - 1
        site.post("/api/newsletter/subscribe", data={"email": sub})
        welcome = wait_until(lambda: newest_outbox("newsletter-bienvenue", t3), timeout=15)
        check(welcome and "desinscription" in welcome["text"], "newsletter : email de bienvenue avec lien de désinscription")
        page.goto(f"{WP}/wp-admin/admin.php?page=tatos-newsletter&q={sub}")
        check(page.get_by_text(sub).count() > 0, "newsletter : abonné listé dans WordPress")
        page.fill('input[name="subject"]', "Lettre de recette")
        page.fill('textarea[name="text"]', "Lettre de recette envoyée depuis WordPress.")
        page.fill('input[name="testEmail"]', sub)
        t4 = time.time() - 1
        page.locator('button[value="test"]').click()
        check("Aperçu envoyé" in notice(page), "newsletter : aperçu envoyé depuis WordPress")
        check(wait_until(lambda: newest_outbox("newsletter", t4), timeout=15), "newsletter : aperçu émis")
        link = re.search(r"email=([^&\s]+)&token=([a-f0-9]+)", welcome["text"]) if welcome else None
        unsub = site.post("/api/newsletter/unsubscribe", data={"email": sub, "token": link.group(2)}) if link else None
        check(unsub is not None and unsub.status == 200, "newsletter : désinscription par le lien de l'email")
        check(site.post("/api/newsletter/unsubscribe", data={"email": sub, "token": "0" * 32}).status == 400, "newsletter : lien falsifié refusé")

        # ---------------------------------------------------------------- Avis et écrans restants
        for slug, label in [("tatos-reviews", "avis clients"), ("tatos-customers", "clients"), ("tatos-messages&kind=services", "rendez-vous"), ("tatos-messages&kind=tickets", "signalements")]:
            page.goto(f"{WP}/wp-admin/admin.php?page={slug}")
            check(page.locator(".notice-error").count() == 0 and page.locator("h1").count() > 0, f"écran {label} : chargé sans erreur")
        cat = json.loads(page.evaluate("fetch('/wp-json/wp/v2/categories-produit?per_page=1&_fields=id').then(r => r.text())"))[0]
        page.goto(f"{WP}/wp-admin/term.php?taxonomy=categorie_produit&tag_ID={cat['id']}&post_type=produit")
        check(page.locator("#tatos-ordre").count() == 1 and page.locator(".tatos-pick-image").count() == 1, "catégories : champs ordre et image disponibles")

        check(not JS_ERRORS, f"aucune erreur JavaScript dans l'administration {JS_ERRORS[:2] if JS_ERRORS else ''}")
        browser.close()

    # La recette ne laisse rien derrière elle : comptes, commandes, messages et abonnés de test supprimés.
    npx = "npx.cmd" if os.name == "nt" else "npx"
    cleaned = subprocess.run([npx, "tsx", "scripts/clean-test-data.ts"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    check(cleaned.returncode == 0, f"nettoyage des données de recette {cleaned.stderr[-300:] if cleaned.returncode else ''}")

    ok = sum(1 for r in RESULTS if r[0])
    print(f"\n{ok}/{len(RESULTS)} vérifications réussies")
    return 0 if ok == len(RESULTS) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        ok = sum(1 for r in RESULTS if r[0])
        print(f"\nInterrompu : {ok}/{len(RESULTS)} vérifications réussies avant l'erreur")
        sys.exit(1)
