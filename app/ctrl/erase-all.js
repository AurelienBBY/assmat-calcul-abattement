/* ============================================================================
   app/ctrl/erase-all.js — « Tout effacer sur cet appareil » (Mon profil)
   ----------------------------------------------------------------------------
   Efface, dans cet ordre : le dossier de copie choisi (ordinateur), les
   photos des fiches, puis toutes les clés « abmat: » ; et recharge la page :
   l'outil repart de zéro, avec la mise en route. Les fichiers de copie de
   secours (iCloud Drive, dossier) ne sont jamais touchés.
   ========================================================================== */

(function () {
  "use strict";

  const A = window.ABMAT.app;
  const R = window.ABMAT.render;
  const S = window.ABMAT.storage;
  const AS = window.ABMAT.autosave;

  if (!A || !A.backup || !A.backup.openSending || !R.buildEraseAll || !S.eraseAll || !S.fiches || !AS.forget) {
    throw new Error("app/ctrl/backup-send.js, render/erase-all.js, storage/declared.js, storage/fiches.js et autosave.js doivent être chargés avant app/ctrl/erase-all.js.");
  }

  async function erase() {
    try {
      await AS.forget();
      await S.fiches.eraseAll();
    } catch (e) {
      R.closeSheet();
      R.toast(`Effacement interrompu : ${e.message} Vos données sont toujours là.`);
      return;
    }
    S.eraseAll();
    window.location.reload();
  }

  A.eraseAllSheet = function eraseAllSheet() {
    const B = A.backup;
    const i = B.info();
    const never = B.manual ? !i.lastSentAt : i.autoStatus !== "ready";
    const model = { manual: B.manual, pendingDays: i.pendingDays, warn: never ? "never" : (B.manual && i.pendingAny ? "pending" : null) };
    const sheet = R.openSheet({ title: "Tout effacer sur cet appareil", body: [] });
    const show = (step) => sheet.setBody(R.buildEraseAll(Object.assign({ step }, model), handlers));
    const handlers = {
      onBackup: () => (B.manual ? B.openSending() : B.chooseFolder()),
      onContinue: () => show("confirm"),
      onCancel: () => R.closeSheet(),
      onErase: () => { show("working"); erase(); }
    };
    show("explain");
  };
})();
