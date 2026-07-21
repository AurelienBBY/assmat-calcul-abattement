# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que fait l'outil

Calculateur de l'**abattement fiscal des assistantes maternelles** (article 80 sexies du CGI, fiche service-public [F1234](https://www.service-public.gouv.fr/particuliers/vosdroits/F1234)). L'utilisatrice saisit les temps de présence des enfants mois par mois ; l'outil calcule l'abattement forfaitaire et le revenu imposable à reporter sur la déclaration.

**Utilisatrice unique** : assistante maternelle employée par un CCAS (hors Pajemploi — aucun récapitulatif fiscal fourni par ailleurs), non technicienne. Toute décision UI/UX se juge à cette aune : saisie minimale, feedback visible, documents imprimables crédibles. Le cap et les lots de travail sont dans `docs/feuille-de-route.md`.

Application **100 % statique et hors-ligne** : un fichier HTML + JS/CSS vanilla, aucune dépendance, aucun serveur, aucun réseau. C'est une **décision produit** — ne jamais introduire de CDN, de npm, de bundler ou d'appel réseau. Cible de distribution à terme : GitHub Pages + PWA (le hors-ligne reste non négociable).

## Lancement

Double-clic sur `index.html` (ou `open index.html`). Il n'y a ni build ni installation. Toute modification JS/CSS est visible au rechargement de la page. En production, l'outil est servi par **GitHub Pages** (déploiement automatique à chaque push sur `main`) en PWA — le service worker (`sw.js`, réseau d'abord / cache en secours) ne s'active qu'en http(s), jamais en ouverture locale.

**Vérification manuelle minimale après toute modification** : ouvrir la page, vérifier les 4 onglets (Accueil, Mes informations, Déclaration, Ma déclaration), l'onboarding en 3 étapes sur Accueil (étape 1 en avant tant que le profil est vide) et le bouton « Voir les points d'attention », saisir des heures sur un mois (cas ≥ 8h et < 8h), renseigner net + IRF, vérifier le résultat mensuel, ouvrir Ma déclaration (encart 1AJ, tableau des mois, comparaison des régimes), tester l'aperçu d'impression du mois et du récap (Cmd+P), puis le bouton « Imprimer le dossier complet » — et que l'icône Imprimer disparaît bien hors Déclaration/Ma déclaration.

## Règles métier (source de vérité)

- Abattement calculé **par jour ET par enfant**.
- Garde **≥ 8h** : forfait = `coefficient (3) × SMIC horaire brut`.
- Garde **< 8h** : prorata = `(forfait ÷ 8) × heures de présence`.
- Le SMIC de référence est celui **au 1er janvier de l'année d'imposition** — les revalorisations en cours d'année (ex. 12,31 € au 01/06/2026) ne comptent pas.
- Revenu imposable = `(net imposable + IRF) − abattement`, plancher à 0.
- Table des SMIC dans `app/config.js`, à mettre à jour une fois par an. Valeurs officielles au 1er janvier : 2023 = 11,27 / 2024 = 11,65 / 2025 = 11,88 / 2026 = 12,02.
- **Hors périmètre assumé** (documenté dans l'UI, ne pas « corriger » sans décision) : garde ≥ 24h, enfant malade/handicapé (majorations spécifiques), samedi/dimanche, plus de 3 enfants par jour.

## Architecture

Pas de modules ES : **l'ordre des `<script>` dans le HTML fait office de système de modules**. Chaque fichier est une IIFE qui augmente un namespace global. Toute nouvelle lib doit être insérée au bon endroit dans `index.html`.

```
window.ABMAT_CONFIG      app/config.js              SMIC par année, coefficient, forfait
window.ABMAT.utils       app/lib/utils.js           dates, parsing HH:MM, formats FR
window.ABMAT.calc        app/lib/calc.js            calculs purs (sans DOM) — testable
window.ABMAT.storage     app/lib/storage.js         localStorage + export/import JSON
window.ABMAT.compute     app/lib/compute/           agrégats (récap, print, prefill)
window.ABMAT.autosave    app/lib/autosave.js        dossier d'auto-sauvegarde (FS Access API)
window.ABMAT.render      app/lib/render/*.js        rendu DOM + événements (1 fichier = 1 zone)
(orchestration)          app/app.js                 état, callbacks, cycle load→render→calc→save
```

CSS découpé par zone dans `app/styles/` (préfixes numériques = ordre de chargement). La fiche de référence est une page séparée (`app/modals/reference.html`) chargée en iframe.

### Design "Liquid Glass" (2026-07-19)

Redesign visuel complet à partir d'un handoff externe (`handoff_liquid_glass/`, conservé à la racine comme référence — maquettes HTML + README détaillé). Teinte **Prune** (`--hue: 322`) et intensité de verre **Médium** fixées en dur dans `00-vars-base.css` (pas de sélecteur runtime en production). Les noms de variables historiques (`--accent`, `--card`, `--muted`…) sont conservés : tout le CSS les consommant récupère le nouveau rendu sans modification. Deux classes de verre réutilisables : `.glass` (cartes) et `.glass-strong` (toolbar, popovers, héros) — voir `00-vars-base.css`.

**Invariant à respecter pour toute nouvelle UI** : ne jamais coder une couleur en dur pour une carte/bouton — utiliser `.glass`/`.glass-strong`/`.btn`/`.btn-primary`/`.pill` ou les tokens `var(--accent)`, `var(--ink)`, `var(--muted)`, etc.

**Toolbar consolidée** : Sauvegarder + Importer fusionnés dans un bouton « Données » (`#abmat-action-data-toggle` → menu `#abmat-data-menu`, contient le statut d'enregistrement et la sauvegarde auto) ; 4 onglets texte piliers (voir section Navigation ci-dessous) ; icône Imprimer. Le bouton Imprimer peut exister à **plusieurs endroits** (icône toolbar + bouton flottant mobile `.fab` + CTA dans le héros du résultat) : `toolbar-actions.js` lie tous les éléments `[data-toolbar-action="print"]` via `querySelectorAll` à chaque appel (indépendant de la garde `abmatBound` qui ne concerne que Sauvegarder/Importer/le fichier caché) — **ne jamais revenir à un `getElementById` unique pour Imprimer**. Les boutons sont montrés/masqués ensemble selon `declarationMode || maDeclarationMode` dans `renderAll` (l'icône imprime le relevé du mois ou le récap annuel seul ; le dossier complet a son propre bouton statique, `#abmat-print-dossier`, non concerné par cette garde).

**Tableau mensuel en cartes** : `day-rows.js`/`month-table.js` génèrent des `<div>` (`.day-row`, `.kids`, `.kidline`…) au lieu de `<tr>/<td>`. Le contrat `data-*` (data-date, data-child, data-slot-index, data-time, data-absent, data-motif, data-action, data-hours, data-abatt, data-day-total, data-week-total) est **strictement identique** à l'ancien tableau — c'est ce qui a permis la réécriture sans toucher aux handlers d'`app.js`. La racine du conteneur garde la classe `abmat-table` (historique, sert aux 2 sélecteurs `document.querySelector(".abmat-table")` dans `app.js` — ne pas la renommer sans mettre à jour ces 2 endroits + l'itération `.day-row[data-date]`). Le tableau **annuel** (`year-recap.js`) est un vrai `<table>` qui partage aussi la classe `abmat-table` par coïncidence de nom historique : son habillage complet vit désormais dans `85-year-recap.css` sous `.year-recap__table`, indépendamment de `.abmat-table`.

`90-print.css` et les gabarits `print-*.js` : **non touchés** par le redesign (décision explicite du handoff — le liquid glass ne s'applique qu'à l'écran, jamais à l'impression).

**Impression** : on n'imprime jamais l'écran. `app.js` (`buildPrintDoc`, déclenché par le bouton Imprimer et par `beforeprint`) génère un document dans `#print-doc` — relevé mensuel (`compute/month-print.js` → `render/print-month.js`) ou récap annuel (`computeYearRecap` → `render/print-year.js`) selon la vue. `90-print.css` masque tout sauf `#print-doc` à l'impression (`body > :not(#print-doc)`) et le style en document serif. Socle commun `render/print-common.js` (en-tête d'identité lisant `abmat:profile`, règles, pied de page) — données via `textContent` uniquement.

`print-year.js`/`print-month.js` exposent chacun deux fonctions : `buildPrintYearSheet`/`buildPrintMonthSheet` **construisent** la `.sheet` sans la rattacher au DOM, `renderPrintYear`/`renderPrintMonth` (utilisées pour l'impression simple) vident `#print-doc` puis y attachent la feuille construite. `render/print-full-year.js` (**dossier complet**, bouton dédié `#abmat-print-dossier` dans Ma déclaration) réutilise ces deux builders tels quels pour assembler dans `#print-doc` : récap annuel puis, pour chaque mois au statut différent de « vide », son relevé (forfait recalculé via `Compute.forfaitJourForMonth`, exposé par `compute/year-recap.js`, pour respecter un `smicOverride` propre à ce mois). `90-print.css` insère un saut de page (`break-before: page`) entre deux `.sheet` consécutives — une impression simple ne produit jamais qu'une seule `.sheet`, la règle ne s'applique donc que dans ce cas d'assemblage.

### Navigation à 4 piliers (2026-07-19, étendue le 2026-07-21)

`state.pillar` = `"accueil" | "infos" | "declaration" | "ma-declaration"` — les 4 destinations de la toolbar (`.pillar-tab[data-pillar]`, texte, pas des icônes : changement rare, la clarté prime sur la compacité). Persisté dans `abmat:ui:pillar` ; au tout premier lancement (rien en mémoire) → `"accueil"` si l'appareil est vraiment vierge (`hasAnyMonthData()` false), sinon `"declaration"` pour ne pas perturber une habitude déjà prise (mise à jour de l'outil sur un appareil déjà utilisé).

- **Accueil** (`render/accueil.js`) : message de bienvenue toujours affiché, puis raccourcis adaptés à l'état du profil (calculés à chaque affichage par `computeAccueilContext()` dans `app.js` — jamais figés). Héberge aussi l'onboarding (`render/onboarding.js`, section suivante) et l'explication des règles (contenu statique dans `index.html`, **plus jamais replié** : Accueil n'étant plus une page visitée à chaque mois, condenser son contenu n'a plus de sens).
- **Mes informations** (`#infos-section`, pleine largeur) : identité + enfants + semaines types, ne vit plus dans la colonne résultat de Déclaration.
- **Déclaration** : saisie du mois uniquement (années/mois, tableau, fiche de paie, résultat collant) — `state.monthIndex` (0-11) n'a de sens que sous ce pilier. Ne contient plus d'onglet RÉCAP dans sa sous-navigation (`period.js`) : ce contenu a été promu au pilier suivant.
- **Ma déclaration** (`#ma-declaration-section`, pleine largeur, `renderMaDeclarationScreen()` dans `app.js`) : reprend **à l'identique** l'ancien contenu du RÉCAP (encart 1AJ, détail par mois cliquable → `goToMonth()` bascule sur Déclaration, comparaison des régimes — `render/year-recap.js` inchangé) avec un sélecteur d'années dédié sans onglets de mois (`R.renderYearOnlySelector` dans `period.js` — mêmes pastilles/badge « déclarée » que Déclaration, `state.year` **partagé** entre les deux piliers). Ajoute le bouton **« Imprimer le dossier complet »** (`#abmat-print-dossier`, cf. section Impression) et son texte dynamique (`updateDossierCard()` compte les mois renseignés).

Helpers dans `app.js` : `isAccueilMode()`, `isInfosMode()` (= `pillar==="infos"`), `isMaDeclarationMode()` (= `pillar==="ma-declaration"`), `isMonthMode()` (= `pillar==="declaration"`, plus simple depuis que le récap a son propre pilier). **`isMonthMode()` gouverne le chargement des données mensuelles** (`loadAndRenderMonth`) — ne jamais réintroduire un test basé sur `monthIndex` seul pour distinguer les autres piliers (les anciens sentinels `monthIndex===12`/`===13` n'existent plus). `#content-grid` (saisie du mois) n'a donc plus qu'un seul mode d'affichage — la classe `.content-grid--single` a été retirée avec le récap qui la justifiait.

**Années déclarées** : case à cocher dans Ma déclaration (`year-recap.js`) → `S.setYearDeclared(year, bool)` (repère manuel local, volontairement **hors export/merge** — ce n'est pas une donnée fiscale) → badge ✓ sur la pastille correspondante, à la fois dans `period.js` (Déclaration) et `R.renderYearOnlySelector` (Ma déclaration), toutes deux lisant `S.getDeclaredYears()`.

### Onboarding (2026-07-21) : explication des 3 piliers + fiche de référence

Remplace l'ancien "tuto" (liste à puces générique + modale en mur de texte). Deux morceaux distincts, volontairement séparés :

- **`#onboarding-section` (Accueil, `render/onboarding.js`)** : 3 cartes reliées par des flèches — Mes informations → Déclaration → Ma déclaration, dans l'ordre où on s'en sert, chacune avec l'icône et le nom exacts de son onglet. Toujours affichée (pas de logique de pliage/masquage) ; l'étape 1 est mise en avant (`.onb-current`, bordure verte) **uniquement** tant que `ctx.profileEmpty` est vrai — c'est alors la seule action possible. Recalculée à chaque affichage d'Accueil comme le reste du contexte (`computeAccueilContext()`), jamais figée.
- **Fiche de référence (`app/modals/reference.html`, chargée en iframe dans la modale existante)** : cas particuliers et points d'attention qui ne collent pas à un moment précis de l'écran (versements décalés type CCAS de Grenoble, 1 enfant = 1 ligne, justificatifs, sauvegarde/impression à jour du lot 10…), en cartes (`app/styles/61-reference.css`, chargé uniquement par cette page, jamais par `index.html`). Ouverte via tout élément portant l'attribut `[data-open-tuto]` — aujourd'hui le bouton "Voir les points d'attention" du bloc onboarding et la carte "book" des raccourcis (profil vide uniquement).

**Piège évité** : le bouton `[data-open-tuto]` vit désormais dans du contenu **recréé à chaque affichage d'Accueil** (`container.innerHTML=""` puis reconstruction), donc une liaison directe (`btn.addEventListener` posée une seule fois au chargement) serait perdue dès le second passage sur Accueil, voire absente d'entrée si Accueil n'est pas le pilier initial. `initTutoModal()` (app.js) et le script de chargement paresseux de l'iframe (bas d'`index.html`) écoutent donc les clics **par délégation sur `document`** (`e.target.closest('[data-open-tuto]')`) plutôt que sur l'élément lui-même — robuste à n'importe quel nombre de (re)créations. Ne jamais revenir à un binding direct sur ce bouton.

### Invariant : une seule source de calcul

Depuis le lot 2, **le DOM n'est jamais lu pour calculer** : `state.data` (mensuel) et le localStorage (récap annuel) alimentent `calc.js`, et le DOM ne fait qu'afficher. Ne jamais réintroduire de lecture d'`<input>` dans un calcul — c'est la divergence entre les deux anciens chemins qui avait produit le bug « abattement annuel = 0 € ». Le récap annuel utilise le forfait de l'année **et le `smicOverride` propre à chaque mois**.

## Données & stockage

Une entrée localStorage par mois, clé `abmat:YYYY-MM`. Le bouton Sauvegarder exporte **l'année complète** (`abattement-assmat-AAAA.json`, format `abmat-year` : enveloppe `{format, version, year, months, profile}`, mois vides exclus). **L'import d'un fichier d'année est une FUSION** (`mergeYearFromJsonText`) : chaque mois porte un `updatedAt` posé par `saveMonth` **uniquement quand le contenu change** — la version la plus récente gagne mois par mois, et un mois modifié des deux côtés depuis `abmat:lastMergedAt` déclenche un arbitrage explicite (callback `resolveConflict`), jamais un écrasement silencieux. Ne jamais réintroduire d'import-remplacement ni de tampon d'horodatage à la consultation. Les anciens fichiers de mois restent importables. Structure mensuelle, normalisée par `storage.js` :

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

**Lot 5 (cœur) fait le 2026-07-19** : vue Mes informations — profil `abmat:profile` (identité, enfants `{name, active, week}`, semaine type lun→ven un créneau/jour), pré-remplissage d'un mois vide (`compute/prefill.js`, action volontaire — jamais automatique), profil embarqué dans l'export d'année, prénoms dans tableau et PDF, encart 1AJ + comparaison des régimes au RÉCAP.

**Lot 9 fait le 2026-07-19** : navigation à 3 piliers (Accueil / Mes informations / Déclaration). `monthIndex===13` (ancien sentinel Infos) a disparu, remplacé par `state.pillar`.

**Lot 10 fait le 2026-07-21** : 4ᵉ pilier « Ma déclaration » — promotion du RÉCAP (retiré de la sous-navigation de Déclaration) au rang de pilier à part entière, détaillée dans la section « Navigation à 4 piliers » ci-dessus, + impression du **dossier complet** (récap annuel + relevés mensuels renseignés, un par page). Vérifié en Chrome headless piloté via CDP (WebSocket natif Node, sans dépendance) : les 4 onglets, le changement d'année dans Ma déclaration, le clic sur un mois du tableau (retour en Déclaration), la case « déclarée », l'impression simple et le dossier complet (assemblage de plusieurs `.sheet`) — aucune exception JS, aucune régression sur les 48 tests.

**Lot 3 fait le 2026-07-19** (3 étapes) : schéma v2 (multi-créneaux + absences, migration auto) ; nouveau tableau de saisie (`render/day-rows.js` + `render/month-table.js` : enfants visibles + « + enfant », « + créneau »/✕, absence avec motif, fériés calculés `U.getFrenchHolidays`, « Recopier la semaine précédente », total du jour — valeurs remplies depuis `state.data` via `createElement`, **jamais de donnée dans innerHTML**) ; thème (accent unique `--accent` #23458c, base 17 px, héros du résultat avec note « au lieu de X € perçus », pilules toolbar « ✓ Enregistré » + total du mois, tuto/explication en `<details>` repliés après première visite — flag `abmat:ui:visited` —, années en pastilles fixes 2023 → courante). 29 tests verts. ⚠️ **Les étapes DOM (tableau + thème) n'ont pas encore été vérifiées dans un navigateur.**

Copies **obsolètes** à ne jamais éditer : `~/Downloads/assmat-refacto*` et le dossier « Assmat - copie archivee 2026-04 » sur le Bureau.

## Tests

Suite sans dépendance basée sur le runner intégré de node — lancer depuis la racine :

```bash
node --test
```

Le harnais (`tests/harness.js`) charge les modules réels (config, utils, calc, storage, compute) avec `window`/`localStorage` simulés. Pas de DOM dans cette suite : les renderers, `app.js` et la navigation à 4 piliers se vérifient à la main dans le navigateur (section Lancement) — éventuellement via un Chrome headless piloté en CDP pour une passe ponctuelle (cf. lot 10), mais aucun script de ce type n'est conservé dans le dépôt. Couverture actuelle : bornes 8 h / prorata / créneaux invalides (`calc.test.js`), imports malformés et export/import d'année (`storage.test.js`), abattement et statuts annuels (`year-recap.test.js`), années déclarées (`declared-years.test.js`). Tout changement du moteur doit faire tourner cette suite avant commit.

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
