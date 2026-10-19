/* Administration TATOS : médiathèque, listes réordonnables, confirmations. */
(function ($) {
  "use strict";
  var counter = 0;

  function preview(field, url) {
    var box = field.find(".tatos-image-preview").empty();
    if (url) box.append($("<img alt=''>").attr("src", url));
  }

  // Choix d'une image dans la médiathèque.
  $(document).on("click", ".tatos-pick-image", function (e) {
    e.preventDefault();
    var field = $(this).closest(".tatos-image-field");
    var frame = wp.media({ title: "Choisir une image", button: { text: "Utiliser cette image" }, library: { type: "image" }, multiple: false });
    frame.on("select", function () {
      var url = frame.state().get("selection").first().toJSON().url;
      field.find(".tatos-image-url").val(url).trigger("change");
      preview(field, url);
    });
    frame.open();
  });
  $(document).on("change", ".tatos-image-url", function () {
    var url = $(this).val();
    preview($(this).closest(".tatos-image-field"), url && url.charAt(0) !== "/" ? url : "");
  });

  // Galerie : plusieurs images ajoutées à la liste (une adresse par ligne).
  $(document).on("click", ".tatos-pick-gallery", function (e) {
    e.preventDefault();
    var area = $("#" + $(this).data("target"));
    var frame = wp.media({ title: "Ajouter des images", button: { text: "Ajouter à la galerie" }, library: { type: "image" }, multiple: true });
    frame.on("select", function () {
      var urls = frame.state().get("selection").map(function (a) { return a.toJSON().url; });
      var current = $.trim(area.val());
      area.val((current ? current + "\n" : "") + urls.join("\n"));
    });
    frame.open();
  });

  // Listes : ajout d'un élément à partir du modèle (seul le premier __INDEX__ de chaque nom est le sien).
  $(document).on("click", ".tatos-add-item", function (e) {
    e.preventDefault();
    var repeater = $(this).closest(".tatos-repeater");
    var tpl = repeater.children("template.tatos-template").get(0);
    var n = Date.now() + "" + counter++;
    var html = tpl.innerHTML
      .replace(/(name="[^"]*?)__INDEX__/g, "$1" + n)
      .replace(/((?:id|for)="tatos-[a-f0-9]+)"/g, "$1-" + n + '"');
    var item = $(html);
    repeater.children(".tatos-items").append(item);
    item.find("input, textarea").first().trigger("focus");
  });
  $(document).on("click", ".tatos-remove-item", function (e) {
    e.preventDefault();
    if (window.confirm("Supprimer cet élément ? (définitif après enregistrement de la page)")) $(this).closest(".tatos-item").remove();
  });
  $(document).on("click", ".tatos-move", function (e) {
    e.preventDefault();
    var item = $(this).closest(".tatos-item");
    if ($(this).data("dir") < 0) item.prev(".tatos-item").before(item);
    else item.next(".tatos-item").after(item);
  });
  $(document).on("input", ".tatos-item > .tatos-field input[type=text]", function () {
    var item = $(this).closest(".tatos-item");
    if ($(this).is(item.find(".tatos-field input[type=text]").first())) item.children(".tatos-item-bar").find(".tatos-item-title").text($(this).val() || "Élément");
  });

  // Confirmations.
  $(document).on("submit", "form.tatos-confirm", function (e) {
    if (!window.confirm("Confirmer la suppression ?")) e.preventDefault();
  });
  $(document).on("submit", "form.tatos-confirm-cancel", function (e) {
    if ($(this).find("select[name=status]").val() === "ANNULEE" && !window.confirm("Annuler cette commande ? Les articles seront remis en stock.")) e.preventDefault();
  });
  $(document).on("submit", "form.tatos-confirm-send", function (e) {
    var submitter = e.originalEvent && e.originalEvent.submitter;
    if (submitter && submitter.value === "all" && !window.confirm("Envoyer cette lettre à tous les abonnés ?")) e.preventDefault();
  });
  // Réglages → Site et magasin : import des contenus du site, par étapes (contenus puis produits par lots).
  $(document).on("click", "#tatos-import", function () {
    var $btn = $(this);
    var $log = $("#tatos-import-log");
    var nonce = $btn.data("nonce");
    if (!window.confirm("Importer les contenus du site dans WordPress ? Les contenus déjà importés seront mis à jour.")) return;
    var say = function (text, cls) {
      $("<p>").text(text).addClass(cls || "").appendTo($log);
    };
    var call = function (data) {
      return $.post(window.ajaxurl, $.extend({ action: "tatos_import", _ajax_nonce: nonce }, data)).then(function (res) {
        if (!res || !res.success) return $.Deferred().reject((res && res.data && res.data.message) || "Erreur inconnue.");
        return res.data;
      }, function (xhr) {
        return $.Deferred().reject("Le serveur WordPress a répondu " + xhr.status + ". Réessayez : l'import reprend sans doublon.");
      });
    };
    $btn.prop("disabled", true).text("Import en cours…");
    $log.empty();
    say("Contenus (coordonnées, pages, articles, FAQ, menus, catégories)…");
    call({ step: "content" })
      .then(function (d) {
        (d.messages || []).forEach(function (m) { say("✓ " + m); });
        var pages = Math.max(1, Math.ceil(d.productCount / d.per));
        var page = 1;
        var done = 0;
        var $progress = $("<p>").appendTo($log);
        var next = function () {
          if (page > pages) return $.Deferred().resolve();
          $progress.text("Produits : " + done + " / " + d.productCount + "…");
          return call({ step: "products", page: page }).then(function (r) {
            done += r.imported;
            page += 1;
            return next();
          });
        };
        return next().then(function () {
          $progress.text("✓ " + done + " produits");
          return call({ step: "finish" });
        });
      })
      .then(function (d) {
        say((d.messages || ["Import terminé."])[0], "tatos-import-ok");
        $btn.prop("disabled", false).text("Importer les contenus du site");
      })
      .fail(function (message) {
        say("Import interrompu : " + message, "tatos-import-error");
        $btn.prop("disabled", false).text("Reprendre l'import");
      });
  });
})(jQuery);
