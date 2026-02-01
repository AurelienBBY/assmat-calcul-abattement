

/* ============================================================================
   Configuration légale / paramètres de calcul
   ----------------------------------------------------------------------------
   Objectif :
   - Centraliser les valeurs "année → SMIC horaire brut" utilisées comme base
     de calcul de l’abattement (assistante maternelle).
   - Éviter toute dépendance réseau : aucune API, aucun scraping.
   - Permettre une mise à jour simple 1 fois par an.

   IMPORTANT :
   - Pour une année donnée, le calcul se base sur le SMIC horaire BRUT au 1er
     janvier de l’année concernée (valeur de référence).
   - Si l’année n’est pas renseignée ici, l’application demandera une saisie
     manuelle (mais restera utilisable).
   ========================================================================== */

/**
 * Configuration globale exposée via window.ABMAT_CONFIG
 * (simple, lisible, sans bundler).
 */
window.ABMAT_CONFIG = {
  /**
   * Coefficient "standard" le plus courant : 3 × SMIC horaire brut.
   * (On le garde en paramètre pour être souple si besoin un jour.)
   */
  coefficient: 3,

  /**
   * Table des SMIC horaires BRUTS au 1er janvier, par année.
   * Clé = année (nombre), valeur = SMIC horaire brut (nombre).
   *
   * À mettre à jour en début d’année :
   * - ajouter une ligne 2026: XX.XX
   * - conserver les anciennes années (utile pour justificatifs / archives)
   */
  smic_horaire_brut: {
    2023: 11.52,
    2024: 11.65,
    2025: 11.88,
    2026: 12.02
  }
};

/**
 * Retourne le SMIC horaire brut pour une année.
 * @param {number} year
 * @returns {number|null}
 */
window.ABMAT_CONFIG.getSmicHoraireBrut = function getSmicHoraireBrut(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  const v = window.ABMAT_CONFIG.smic_horaire_brut[y];
  return (typeof v === "number" && Number.isFinite(v)) ? v : null;
};

/**
 * Calcule le forfait journalier (par enfant) à partir du SMIC horaire brut.
 * Arrondi à 2 décimales.
 *
 * @param {number} smic - SMIC horaire brut
 * @param {number} coefficient - généralement 3
 * @returns {number}
 */
window.ABMAT_CONFIG.computeForfaitJourFromSmic = function computeForfaitJourFromSmic(smic, coefficient) {
  const s = Number(smic);
  const c = Number(coefficient);
  if (!Number.isFinite(s) || !Number.isFinite(c)) return 0;
  // Arrondi à 2 décimales (euros)
  return Math.round((s * c) * 100) / 100;
};

/**
 * Formate un montant en euros au format français (2 décimales).
 * @param {number} amount
 * @returns {string}
 */
window.ABMAT_CONFIG.formatEuro = function formatEuro(amount) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
};