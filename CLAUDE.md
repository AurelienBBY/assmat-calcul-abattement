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

### Invariant : une seule source de calcul

Depuis le lot 2, **le DOM n'est jamais lu pour calculer** : `state.data` (mensuel) et le localStorage (récap annuel) alimentent `calc.js`, et le DOM ne fait qu'afficher. Ne jamais réintroduire de lecture d'`<input>` dans un calcul — c'est la divergence entre les deux anciens chemins qui avait produit le bug « abattement annuel = 0 € ». Le récap annuel utilise le forfait de l'année **et le `smicOverride` propre à chaque mois**.

## Données & stockage

Une entrée localStorage par mois, clé `abmat:YYYY-MM`. Le bouton Sauvegarder exporte **l'année complète** (`abattement-assmat-AAAA.json`, format `abmat-year` : enveloppe `{format, version, year, months}` où chaque mois garde la structure ci-dessous, mois vides exclus). L'import accepte ce format **et** les anciens fichiers de mois. Structure mensuelle, normalisée par `storage.js` :

```json
{
  "version": 2,
  "year": 2026,
  "monthIndex": 0,
  "smicOverride": null,
  "netImposable": 0,
  "irf": 0,
  "days": {
    "2026-01-05": {
      "children": {
        "1": { "absent": false, "motif": "", "slots": [ { "in": "08:00", "out": "17:00" } ] },
        "2": { "absent": true, "motif": "malade", "slots": [] },
        "3": { "absent": false, "motif": "", "slots": [] }
      }
    }
  }
}
```

⚠️ **`days` est un objet indexé par date ISO, pas un tableau** (le bug historique du récap annuel venait d'un `Array.isArray` sur cette structure). `children` = enfants 1 à 3 ; chaque enfant porte une **liste de créneaux** (max 3, les heures s'additionnent sur la journée avant la règle ≥ 8 h) et un éventuel marquage d'absence. La **migration v1 → v2** (ancien `slots: {"1":{in,out}}`) est automatique dans `normalizeData()` — tout nouveau changement de schéma incrémente `version` et ajoute sa migration au même endroit.

## Documentation (docs/)

- `docs/feuille-de-route.md` — **où on va et pourquoi** : cap produit, lots 1 à 6 (fiabilité → moteur unifié → UI → PDF → parcours → distribution PWA), décisions en attente. À mettre à jour quand un lot avance ou qu'une décision est prise.

## État connu (audit du 2026-07-19, lot 1 corrigé le même jour)

**Corrigés (lot 1)** : récap annuel réécrit (`compute/year-recap.js` recalcule via `S.loadMonth` + `C.computeMonthTotal`, avec le `smicOverride` du mois — abattement, jours-enfant et statuts réels) ; SMIC 2023 corrigé à 11,27 ; sentinel toolbar (`#period-sentinel`) ; garde utils réelle dans `render/index.js`. Côté renderers, l'audit initial s'était trompé de sens : c'était **`rules.js` qui n'était pas chargé** (le `<script>` pointait encore sur `year-abattement.js`, provoquant un affichage en double de l'explication). Le HTML charge désormais `rules.js` ; `year-abattement.js` est supprimé. Vérification hors navigateur : harnais node sur les vrais fichiers (15 assertions).

**Lot 2 fait le 2026-07-19** : calculs mensuels depuis `state.data` (le DOM n'est plus lu), export/import de l'année complète (corrige l'export « null » depuis le RÉCAP), suite `node --test`.

**Lot 3 en cours — étapes 1/3 et 2/3 faites le 2026-07-19** : schéma v2 (multi-créneaux + absences, migration auto) puis nouveau tableau de saisie (`render/day-rows.js` + `render/month-table.js` : enfants visibles + « + enfant », « + créneau »/✕, absence avec motif, fériés calculés `U.getFrenchHolidays`, « Recopier la semaine précédente », total du jour). Le renderer remplit les valeurs depuis `state.data` via `createElement` — **jamais de donnée dans innerHTML** (anti-XSS sur les imports). 29 tests verts, mais **le tableau n'a pas encore été vérifié dans un navigateur**. Étape restante : le thème (accent, héros, « ✓ Enregistré », tuto replié, années fixes).

Copies **obsolètes** à ne jamais éditer : `~/Downloads/assmat-refacto*` et le dossier « Assmat - copie archivee 2026-04 » sur le Bureau.

## Tests

Suite sans dépendance basée sur le runner intégré de node — lancer depuis la racine :

```bash
node --test
```

Le harnais (`tests/harness.js`) charge les modules réels (config, utils, calc, storage, compute) avec `window`/`localStorage` simulés. Pas de DOM : les renderers et `app.js` se vérifient à la main dans le navigateur (section Lancement). Couverture actuelle : bornes 8 h / prorata / créneaux invalides (`calc.test.js`), imports malformés et export/import d'année (`storage.test.js`), abattement et statuts annuels (`year-recap.test.js`). Tout changement du moteur doit faire tourner cette suite avant commit.

Sémantique historique à connaître : deux horaires *tous deux* imparsables valent « empty » (case vide), pas « invalid » — documenté dans `calc.test.js`.

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
