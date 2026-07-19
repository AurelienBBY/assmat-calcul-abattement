# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que fait l'outil

Calculateur de l'**abattement fiscal des assistantes maternelles** (article 80 sexies du CGI, fiche service-public [F1234](https://www.service-public.gouv.fr/particuliers/vosdroits/F1234)). L'utilisatrice saisit les temps de présence des enfants mois par mois ; l'outil calcule l'abattement forfaitaire et le revenu imposable à reporter sur la déclaration.

**Utilisatrice unique** : assistante maternelle employée par un CCAS (hors Pajemploi — aucun récapitulatif fiscal fourni par ailleurs), non technicienne. Toute décision UI/UX se juge à cette aune : saisie minimale, feedback visible, documents imprimables crédibles. Le cap et les lots de travail sont dans `docs/feuille-de-route.md`.

Application **100 % statique et hors-ligne** : un fichier HTML + JS/CSS vanilla, aucune dépendance, aucun serveur, aucun réseau. C'est une **décision produit** — ne jamais introduire de CDN, de npm, de bundler ou d'appel réseau. Cible de distribution à terme : GitHub Pages + PWA (le hors-ligne reste non négociable).

## Lancement

Double-clic sur `Calcul abattement.html` (ou `open "Calcul abattement.html"`). Il n'y a ni build ni installation. Toute modification JS/CSS est visible au rechargement de la page.

**Vérification manuelle minimale après toute modification** : ouvrir la page, saisir des heures sur un mois (cas ≥ 8h et < 8h), renseigner net + IRF, vérifier le résultat mensuel, ouvrir l'onglet RÉCAP, puis tester l'aperçu d'impression (Cmd+P).

## Règles métier (source de vérité)

- Abattement calculé **par jour ET par enfant**.
- Garde **≥ 8h** : forfait = `coefficient (3) × SMIC horaire brut`.
- Garde **< 8h** : prorata = `(forfait ÷ 8) × heures de présence`.
- Le SMIC de référence est celui **au 1er janvier de l'année d'imposition** — les revalorisations en cours d'année (ex. 12,31 € au 01/06/2026) ne comptent pas.
- Revenu imposable = `(net imposable + IRF) − abattement`, plancher à 0.
- Table des SMIC dans `app/config.js`, à mettre à jour une fois par an. Valeurs officielles au 1er janvier : 2023 = 11,27 / 2024 = 11,65 / 2025 = 11,88 / 2026 = 12,02.
- **Hors périmètre assumé** (documenté dans l'UI, ne pas « corriger » sans décision) : garde ≥ 24h, enfant malade/handicapé (majorations spécifiques), samedi/dimanche, plus de 3 enfants par jour.

## Architecture

Pas de modules ES : **l'ordre des `<script>` dans le HTML fait office de système de modules**. Chaque fichier est une IIFE qui augmente un namespace global. Toute nouvelle lib doit être insérée au bon endroit dans `Calcul abattement.html`.

```
window.ABMAT_CONFIG      app/config.js              SMIC par année, coefficient, forfait
window.ABMAT.utils       app/lib/utils.js           dates, parsing HH:MM, formats FR
window.ABMAT.calc        app/lib/calc.js            calculs purs (sans DOM) — testable
window.ABMAT.storage     app/lib/storage.js         localStorage + export/import JSON
window.ABMAT.compute     app/lib/compute/           agrégats (récap annuel)
window.ABMAT.render      app/lib/render/*.js        rendu DOM + événements (1 fichier = 1 zone)
(orchestration)          app/app.js                 état, callbacks, cycle load→render→calc→save
```

CSS découpé par zone dans `app/styles/` (préfixes numériques = ordre de chargement) ; `90-print.css` porte toute la mise en page PDF/impression. Le tutoriel est une page séparée (`app/modals/tuto.html`) chargée en iframe.

### Piège : deux chemins de calcul distincts

- **Vue mensuelle** : app.js lit les `<input type="time">` du DOM et appelle `calc.js` ligne par ligne.
- **Vue RÉCAP annuelle** : `compute/year-recap.js` relit les 12 mois depuis **localStorage** et doit recalculer avec `C.computeMonthTotal(data.days, forfaitJour)` — en utilisant le forfait de l'année **et le `smicOverride` propre à chaque mois**.

Toute évolution du calcul doit être répercutée sur **les deux** chemins.

## Données & stockage

Une entrée localStorage par mois, clé `abmat:YYYY-MM`. L'export JSON (bouton Sauvegarder) et l'import utilisent exactement la même structure, normalisée par `storage.js` :

```json
{
  "version": 1,
  "year": 2026,
  "monthIndex": 0,
  "smicOverride": null,
  "netImposable": 0,
  "irf": 0,
  "days": {
    "2026-01-05": { "slots": { "1": { "in": "08:00", "out": "17:00" }, "2": {}, "3": {} } }
  }
}
```

⚠️ **`days` est un objet indexé par date ISO, pas un tableau** (le bug historique du récap annuel venait d'un `Array.isArray` sur cette structure). `slots` = enfants 1 à 3. Champ modifié → incrémenter `version` et gérer la migration dans `normalizeData()`.

## Documentation (docs/)

- `docs/feuille-de-route.md` — **où on va et pourquoi** : cap produit, lots 1 à 6 (fiabilité → moteur unifié → UI → PDF → parcours → distribution PWA), décisions en attente. À mettre à jour quand un lot avance ou qu'une décision est prise.

## État connu (audit du 2026-07-19)

Bugs identifiés, à corriger avant toute nouvelle fonctionnalité (détail et priorisation dans `docs/feuille-de-route.md`, lot 1) :

- **P0 — Récap annuel : abattement toujours 0 €.** `app/lib/compute/year-recap.js` appelle des fonctions inexistantes (`computeMonthAbattement`…) dont les échecs sont avalés par try/catch. À réécrire simplement autour de `S.loadMonth` + `C.computeMonthTotal`.
- **P0 — Récap annuel : compteurs J<8h / J≥8h toujours 0** (`extractDayRows` attend un tableau, `days` est un objet) → statuts Vide/Incomplet faux.
- **P0 — `config.js` : SMIC 2023 = 11,52 au lieu de 11,27** (11,52 est la valeur du 01/05/2023, pas du 1er janvier).
- **P1 — Une seule plage horaire par enfant/jour** : une garde en deux fois (périscolaire) saisie en une plage donne le forfait complet à tort.
- **P2 — Nettoyage** : `render/year-abattement.js` est du code mort (doublon divergent de `rules.js`) ; sentinel `#toolbar-sentinel` vs `#period-sentinel` (mode compact jamais actif) ; `render/index.js` teste `window.U` jamais défini (warning console) ; typo « pour en année » dans `rules.js`.

Copies **obsolètes** à ne jamais éditer : `~/Downloads/assmat-refacto*` et le dossier « Assmat - Calcul abattement copy » (à sortir du dépôt).

## Tests

Aucun test automatisé pour l'instant. `calc.js` et `storage.js` sont volontairement sans DOM : quand des tests arrivent, les mettre dans `tests/` et couvrir en priorité `computeHoursAndAbattForSlot` (bornes 8h, prorata, invalide, vide) et `normalizeData` (imports malformés).

## Conventions de développement

### 1. Langue
Tout en **français** : commentaires, en-têtes de fichiers, messages d'erreur, textes UI, commits.

### 2. Échouer bruyamment
**Interdiction du code défensif silencieux** : pas de try/catch qui avale, pas de fallback multi-signatures « au cas où », pas de `|| 0` masquant une fonction absente. C'est précisément ce style qui a caché le bug P0 du récap annuel pendant des mois. Si une dépendance manque, `throw` avec un message clair (comme le font déjà les guards `ABMAT.utils est requis…`).

### 3. Pas de code mort ni d'alias de compat
Supprimer plutôt que conserver (`R.renderX || R.renderY`, anciens noms « pendant la refacto »). Le dépôt git garde l'historique.

### 4. Taille des fichiers
~150 lignes max par fichier ; au-delà, découper par responsabilité (modèle existant : un fichier `render/` par zone d'écran).

### 5. KISS / SOLID / POO progressive
Une fonction = une chose ; noms explicites ; pas de duplication. Refactoriser en classe uniquement au moment où l'on touche un fichier qui le justifie (état partagé implicite, fonction qui grossit) — pas de réécriture globale.

### 6. Schémas Mermaid
Tout diagramme (flux de calcul, structure des données) vit dans `docs/` au format Mermaid, un fichier par schéma, mis à jour à chaque changement structurel.

### 7. Avant / après chaque modification
- Avant : lire le fichier **en entier** ; grep les appelants dans `app/` avant de changer une signature.
- Après : vérification manuelle minimale (section Lancement) — y compris l'onglet RÉCAP et l'impression, les deux zones les plus fragiles.

### 8. Git — commits atomiques
Format existant de l'historique : `type(scope): description courte en français` (`feat`, `fix`, `refactor`, `style`, `docs`, `chore`).

```
fix(recap-annuel): calcul réel de l'abattement depuis le storage
fix(config): SMIC 2023 corrigé à 11,27 (valeur au 1er janvier)
chore(render): suppression du doublon year-abattement.js
```

Un commit = un changement logique. Ne pas mélanger refactor et fix.
