# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que fait l'outil

Calculateur de l'**abattement fiscal des assistantes maternelles** (article 80 sexies du CGI, fiche service-public [F1234](https://www.service-public.gouv.fr/particuliers/vosdroits/F1234)) et des **heures supplémentaires**. L'utilisatrice pointe les arrivées et départs au jour le jour sur son iPhone, ou vérifie chaque mois un calendrier pré-rempli avec les horaires habituels ; l'outil calcule l'abattement, le montant à déclarer (case 1AJ/1BJ) et les heures supplémentaires, expliquées jour par jour.

**Utilisatrice unique** : assistante maternelle employée par un CCAS (hors Pajemploi — aucun récapitulatif fiscal fourni par ailleurs), non technicienne, surtout sur iPhone. Toute décision UI/UX se juge à cette aune : saisie minimale (par exceptions), feedback visible, textes sans jargon, documents imprimables crédibles. Le cap et les lots de travail sont dans `docs/feuille-de-route.md`.

Application **100 % statique et hors-ligne** : un fichier HTML + JS/CSS vanilla, aucune dépendance, aucun serveur, aucun réseau. C'est une **décision produit** — ne jamais introduire de CDN, de npm, de bundler ou d'appel réseau (CloudKit rejeté pour cette raison, cf. feuille de route).

## Lancement

Double-clic sur `index.html` (ou `open index.html`). Il n'y a ni build ni installation. Toute modification JS/CSS est visible au rechargement de la page. En production, l'outil est servi par **GitHub Pages** (déploiement automatique à chaque push sur `main`) en PWA — le service worker (`sw.js`, réseau d'abord / cache en secours) ne s'active qu'en http(s), jamais en ouverture locale.

**Vérification manuelle minimale après toute modification**, sur ordinateur ET en largeur iPhone (onglets en bas) : premier lancement vierge (carte de bienvenue) ; **Aujourd'hui** (arrivée, départ, absence, relais, début/fin de réunion, heures sup. « pour l'instant ») ; **Mon mois** (calendrier, fiche du jour avec une heure corrigée et une absence, « Semaine de congés » puis « Annuler », fiche de paie « 1 850,40 », « J'ai terminé ») ; **Mon année** (montant = récap, tuile → mois, « Préparer AAAA ») ; **Mon profil** (changer des horaires « à partir du… », ajouter un enfant) ; impression du mois, du récap et du dossier complet (Cmd+P) ; mode sombre ; aucun défilement horizontal à 390 px.

## Règles métier (source de vérité)

- Abattement calculé **par jour ET par enfant**.
- Garde **≥ 8h** : forfait = `coefficient (3) × SMIC horaire brut`.
- Garde **< 8h** : prorata = `(forfait ÷ 8) × heures de présence`.
- Le SMIC de référence est celui **au 1er janvier de l'année d'imposition** — les revalorisations en cours d'année (ex. 12,31 € au 01/06/2026) ne comptent pas. **Un seul SMIC par année** : réglage de l'année (`abmat:settings:AAAA`, écran « Préparer AAAA »), sinon barème de `app/config.js` (2023 = 11,27 / 2024 = 11,65 / 2025 = 11,88 / 2026 = 12,02, à compléter chaque année) ; SMIC inconnu → aucun abattement inventé, l'écran le signale.
- Revenu imposable = `(net imposable + IRF) − abattement`, **calculé sur l'année** : le plancher à 0 s'applique **une seule fois**, au total annuel (case 1AJ, ou 1BJ pour le déclarant 2). Le solde d'un mois (`apres`) peut être négatif et se déduit des autres mois — ne jamais additionner des mois plafonnés à 0.
- **Au plus 4 enfants présents en même temps** (`maxChildrenAtOnce`, contrôlé par `calc.maxSimultaneous` — c'est la simultanéité qui compte, pas le nombre d'enfants dans la journée). Enfants du profil datés (arrivée, départ), en nombre illimité sur l'année. **Accueil relais** : case par année ; prénom saisi le jour même (ids `r1`, `r2`…).
- **Heures supplémentaires** (`app/lib/overtime.js`, `docs/spec-heures-supplementaires.md`) : journée = de la 1re arrivée au dernier départ (creux compris) + réunions hors de cette plage (union, sans double compte, la pause entre départ et réunion ne compte pas) ; au-delà de 10 h, toute demi-heure commencée est due ; réunion un jour sans enfant : toute la durée est due (arrondie). Horaire incomplet → « à vérifier », jamais calculé.
- **Hors périmètre assumé** (ne pas « corriger » sans décision) : garde ≥ 24h, enfant malade/handicapé (majorations spécifiques), dimanche, majoration des heures sup. (questions ouvertes Q4–Q7 de la spec).

## Architecture

Pas de modules ES : **l'ordre des `<script>` dans `index.html` fait office de système de modules** (schéma : `docs/architecture-ecrans.md`). Chaque fichier est une IIFE qui augmente un namespace global et **lève une erreur** si une dépendance manque.

```
window.ABMAT_CONFIG      app/config.js              SMIC par année, coefficient, maxChildrenAtOnce, overtime
window.ABMAT.utils       app/lib/utils.js           dates, fériés, HH:MM, montants FR (parseMoneyFR)
window.ABMAT.calc        app/lib/calc.js            abattement jour/mois, maxSimultaneous — pur, testé
window.ABMAT.overtime    app/lib/overtime.js        heures sup. + phrases d'explication — pur, testé
window.ABMAT.storage     app/lib/storage/*.js       core, month (v3), profile (v2), year-settings,
                                                    declared (+ eraseYear), sync (export/fusion), device
window.ABMAT.autosave    app/lib/autosave.js        dossier de copie automatique (File System Access)
window.ABMAT.compute     app/lib/compute/*.js       children, year-recap, month-print, prefill,
                                                    month-view (calendrier), punch (pointeuse),
                                                    backup-rules (rappels iPhone) — purs, testés
window.ABMAT.render      app/lib/render/*.js        DOM uniquement, 1 fichier = 1 zone d'écran
window.ABMAT.app         app/ctrl/*.js              état, données, gestes (1 fichier = 1 écran)
(démarrage)              app/app.js                 onglets, aide, onglet de départ, service worker
```

- **`render/`** reçoit un modèle + des handlers et construit le DOM avec `R.h(tag, props, enfants)` (`render/dom.js`) : **jamais de donnée dans `innerHTML`**. Formats français dans `render/format.js` (`R.fmt`). Fenêtres et message du bas dans `render/sheet.js` (`R.openSheet`, `R.toast`).
- **`app/ctrl/`** : `ctx.js` (état `A.state`, lecture/écriture, instantanés « Annuler », `A.render`), un contrôleur par écran (`today`, `month` + `day` pour la fiche du jour, `year` + « Préparer AAAA », `profile` + `profile-edit`), `backup` + `backup-folder` (copie de secours), `print`. Chaque écran s'enregistre dans `A.views[onglet] = { render(main) }`.
- **Chaque geste relit le stockage, modifie, enregistre** (`A.loadMonth` → `Compute.*` → `A.saveMonth`) : aucune copie en mémoire qui pourrait diverger. Seule la fiche du jour garde le mois ouvert le temps de la fenêtre (modale).
- **« Annuler »** (`A.snapshot` + `A.undoable`) restaure par un **nouvel enregistrement** (nouvel `updatedAt`) — jamais par écriture brute d'un ancien état, sinon la fusion entre appareils ré-appliquerait la version annulée.

### Écrans (lot 12, 2026-09-29)

4 onglets `[data-tab]` (en haut sur ordinateur, en bas sur iPhone ≤ 640 px), état `A.state.tab` = `today | month | year | profile`, non mémorisé : ouverture sur **Aujourd'hui** sur téléphone et au premier lancement (carte de bienvenue si aucune donnée), **Mon mois** sur ordinateur. `A.state.year` est partagé entre Mon mois et Mon année.

- **Aujourd'hui** (`ctrl/today.js`, `render/today.js` + `punch-card.js`) : pointeuse à l'heure du téléphone (`compute/punch.js`), heures corrigeables, heures sup. recalculées chaque minute (horloge et encart seulement, jamais pendant une saisie).
- **Mon mois** (`ctrl/month.js`, `render/calendar.js` + `month-panel.js` + `overtime-view.js`) : calendrier `Compute.buildCalendar` (habituel / modifié / pointé / non travaillé / férié / à venir / aujourd'hui), « Semaine de congés », samedis (réunions), 3 étapes (`verified`, fiche de paie, `done`), heures sup. des jours passés (`A.hsDays`), résultat du mois. **Fiche du jour** (`ctrl/day.js`, `render/day-sheet.js` + `day-kid.js`) : une heure modifiée met à jour les chiffres sans reconstruire (`R.fillDayFigures`), le reste reconstruit.
- **Mon année** (`ctrl/year.js`, `render/year-view.js` + `prepare-year.js`) : montant de `Compute.computeYearRecap`, tuiles des 12 mois, avec/sans abattement, réglages, documents, « Préparer AAAA » (SMIC, enfants qui continuent → date de départ au 31/12, relais).
- **Mon profil** (`ctrl/profile.js` + `profile-edit.js`, `render/profile.js` + `profile-child.js`) : identité, relais de l'année, enfants (horaires en vigueur, historique, changement « à partir du … »), copie de secours, effacer une année. Un changement d'enfant est reporté par `Compute.rescheduleMonth` sur les mois enregistrés : **seuls les jours encore « comme d'habitude » d'un mois non terminé bougent** — jamais un jour pointé, modifié à la main ou non travaillé.
- **Actions de masse** (« Semaine de congés », « Journée habituelle ») : un **jour pointé n'est jamais touché** (heures réelles).
- **Aide** (`?` de l'en-tête) : `app/modals/reference.html` (styles `61-reference.css`, jamais chargés par `index.html`) en iframe dans une fenêtre.

### Copie de secours (iCloud Drive, décision 2026-09-29)

- **Ordinateur** (`AS.isSupported()` : File System Access) : dossier choisi une fois (iCloud Drive via « iCloud pour Windows », ou OneDrive) ; `abattement-assmat-AAAA.json` réécrit 0,6 s après chaque modification, relu et fusionné à l'ouverture de chaque année (`ctrl/backup-folder.js`). Aucun rappel.
- **iPhone** (pas d'accès aux dossiers) : « Envoyer ma copie » (feuille de partage → Enregistrer dans Fichiers → iCloud Drive → Remplacer) et « Reprendre la copie » (fichier choisi → fusion). Rappels selon `Compute.backupPrompt` : question de reprise à l'ouverture (dernière reprise > 7 jours, « Non » = une semaine de calme), envoi proposé au mois terminé, en fin de journée pointée (≥ 3 jours en attente, simple message) et à l'ouverture si la copie a plus de 7 jours (« Plus tard » = 3 jours). **Au plus une fenêtre par jour, jamais pendant qu'un enfant est pointé présent** (bandeau à la place). État dans `abmat:sync` (`storage/device.js`, jamais exporté) ; `A.saveMonth` y note les jours réellement modifiés (« 5 j. à envoyer »).

### Design (lot 12, maquette validée le 2026-09-29)

Fonds **opaques**, teinte **Prune** (`--hue: 322`), mode sombre automatique (`prefers-color-scheme`), base 17 px, boutons ≥ 44 px. Jetons et composants communs dans `app/styles/00-vars-base.css` (`--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-soft`, `--ok`, `--warn`… ; `.card`, `.btn`, `.btn-primary`, `.btn-quiet`, `.chip`, `.field`, `.money`, `.check`). **Invariant** : aucune couleur en dur hors de `00-vars-base.css` (et du document imprimé) — uniquement ces jetons et composants. Le verre (« Liquid Glass » de 2026-07, dossier `handoff_liquid_glass/`) est abandonné : ce dossier n'est plus qu'un historique.

**Pièges de noms de classes** : la fenêtre s'appelle `.dlg` (pas `.sheet`, réservé aux feuilles imprimées de `#print-doc`) ; `.row` existe à l'écran et dans le document imprimé (neutralisé dans `90-print.css`). Avant toute nouvelle classe, vérifier qu'elle n'existe pas dans `render/print-*.js`.

### Impression

On n'imprime jamais l'écran : `ctrl/print.js` construit un document dans `#print-doc` — relevé du mois (`compute/month-print.js` → `render/print-month.js`), récap de l'année (`render/print-year.js`) ou **dossier complet** (`render/print-full-year.js` : récap puis chaque mois renseigné, un par page). `90-print.css` masque tout le reste (`body > :not(#print-doc)`) et met en page en serif. Cmd/Ctrl+P construit le document de l'onglet affiché (`beforeprint`), **sauf** si un bouton vient de le faire (drapeau levé à `afterprint`) — sans ce drapeau, `window.print()` (qui déclenche lui-même `beforeprint`) remplacerait le dossier complet par le seul récap.

### Invariant : une seule source de calcul

**Le DOM n'est jamais lu pour calculer** : le stockage alimente `calc.js`/`overtime.js`/`compute/`, et le DOM ne fait qu'afficher (les formulaires du profil transmettent leurs valeurs aux handlers, rien d'autre). C'est la divergence entre deux chemins de calcul qui avait produit le bug « abattement annuel = 0 € ».

## Données & stockage

Schéma détaillé et migrations : `docs/schema-donnees-v3.md`. Clés localStorage :

```
abmat:AAAA-MM          un mois (v3) : netImposable, irf, verified, done, days
abmat:profile          profil (v2) : firstName, lastName, employer, children datés + periods
abmat:settings:AAAA    réglages d'une année : smic (ou null), relais
abmat:declaredYears    années marquées « déclarées » (repère local, hors export)
abmat:lastMergedAt     dernière synchro (arbitrage des conflits de fusion)
abmat:sync             état de la copie manuelle sur CET appareil (hors export)
IndexedDB abmat-autosave : le dossier de copie choisi (ordinateur)
```

Un mois v3 : `days` est un **objet indexé par date ISO** (jamais un tableau) ; chaque jour `{ off, children: { c1: { absent, motif, slots: [{in,out}] ≤ 3, punched }, r1: { …, relais, name } }, meetings: [{in,out}] }`. Les jours et présences vides sont retirés à la lecture. Les migrations v1/v2 → v3 (clés `"1"` → `"c1"`, `smicOverride` abandonné) et profil v1 → v2 sont faites **à la lecture** ; tout nouveau changement de schéma incrémente `version` et ajoute sa migration au même endroit.

`updatedAt` n'est posé **que si le contenu change** (`S.sameContent`). La sauvegarde est **l'année complète** (`abattement-assmat-AAAA.json`, format `abmat-year` v2 : `{format, version, year, months, profile, settings}`) et **l'import est une FUSION** (`S.mergeYearFromJsonText`) : la version la plus récente gagne mois par mois, un mois modifié des deux côtés depuis `abmat:lastMergedAt` est arbitré (`resolveConflict`), jamais écrasé en silence. Ne jamais réintroduire d'import-remplacement ni d'horodatage à la consultation. Les anciens fichiers d'un seul mois restent importables.

**Montants** : champs texte (`inputmode="decimal"`) lus par `U.parseMoneyFR` (virgule ou point, espaces ignorés, 2 décimales ; saisie ambiguë refusée et signalée). Ne jamais revenir à `<input type="number">` (lecture dépendante de la langue du navigateur).

## Documentation (docs/)

- `docs/feuille-de-route.md` — **où on va et pourquoi** : cap produit, lots, décisions (et celles en attente). À mettre à jour quand un lot avance ou qu'une décision est prise.
- `docs/revue-2026-09-29.md` — revue complète (justesse, saisie, RGPD, design, éco-conception, textes, code) ; captures dans `docs/revue-2026-09-29/`.
- `docs/spec-heures-supplementaires.md` — règle des heures supplémentaires validée, exemples, questions ouvertes.
- `docs/schema-donnees-v3.md` — schéma des données (Mermaid) et migrations.
- `docs/architecture-ecrans.md` — ordre de chargement et dépendances des modules (Mermaid).

## État connu

- **Lots 1 à 5, 9, 10 (2026-07)** : récap annuel recalculé depuis le stockage, calculs sans lecture du DOM, export/fusion de l'année, profil et pré-remplissage, navigation par piliers, dossier complet.
- **Revue du 2026-09-29** : corrections P0 (case 1AJ calculée sur l'année, dossier complet, montants en texte, défauts visuels, textes).
- **Lot 12 (2026-09-29)** : données v3 (enfants datés, horaires versionnés, relais, jours non travaillés, réunions, SMIC par année), heures supplémentaires, puis nouvelle interface (pointeuse, calendrier, fiche du jour, passage d'année, copie iCloud avec rappels, effacer une année). Vérifié dans Chromium piloté par Playwright (ordinateur, iPhone 13, mode sombre, impression, anciennes données v1/v2) — scripts ponctuels, non conservés dans le dépôt.

Copies **obsolètes** à ne jamais éditer : `~/Downloads/assmat-refacto*` et le dossier « Assmat - copie archivee 2026-04 » sur le Bureau.

## Tests

Suite sans dépendance basée sur le runner intégré de node — lancer depuis la racine :

```bash
node --test
```

Le harnais (`tests/harness.js`) charge les modules réels (config, utils, calc, overtime, storage, compute — même ordre qu'`index.html`) avec `window`/`localStorage` simulés. Pas de DOM dans cette suite : les écrans se vérifient dans le navigateur (section Lancement). Couverture (87 tests) : bornes 8 h / prorata / créneaux invalides / simultanéité (`calc`), heures sup. et explications (`overtime`), stockage v3, migrations et fusion (`storage`, `merge`), profil daté, pré-remplissage et report d'un changement d'horaires (`profile`), récap et case 1AJ annuelle (`year-recap`, `month-print`), calendrier (`month-view`), pointeuse (`punch`), rappels de copie (`backup-rules`), années déclarées et effacement (`declared-years`), montants (`utils`). Tout changement du moteur doit faire tourner cette suite avant commit.

Sémantique historique à connaître : deux horaires *tous deux* imparsables valent « empty » (case vide), pas « invalid » — documenté dans `calc.test.js`.

## Conventions de développement

### 1. Langue
Tout en **français** : commentaires, en-têtes de fichiers, messages d'erreur, textes UI, commits.

### 2. Échouer bruyamment
**Interdiction du code défensif silencieux** : pas de try/catch qui avale, pas de fallback multi-signatures « au cas où », pas de `|| 0` masquant une fonction absente. C'est précisément ce style qui a caché le bug P0 du récap annuel pendant des mois. Si une dépendance manque, `throw` avec un message clair ; une erreur que l'utilisatrice peut rencontrer (fichier illisible, mémoire pleine) s'affiche dans un message, jamais dans la seule console.

### 3. Pas de code mort ni d'alias de compat
Supprimer plutôt que conserver (`R.renderX || R.renderY`, anciens noms « pendant la refacto »). Le dépôt git garde l'historique.

### 4. Taille des fichiers
~150 lignes max par fichier ; au-delà, découper par responsabilité (modèle : un fichier `render/` par zone d'écran, un fichier `ctrl/` par écran).

### 5. KISS / SOLID / POO progressive
Une fonction = une chose ; noms explicites ; pas de duplication. Refactoriser en classe uniquement au moment où l'on touche un fichier qui le justifie — pas de réécriture globale.

### 6. Schémas Mermaid
Tout diagramme (flux de calcul, structure des données, modules) vit dans `docs/` au format Mermaid, un fichier par schéma, mis à jour à chaque changement structurel.

### 7. Avant / après chaque modification
- Avant : lire le fichier **en entier** ; grep les appelants dans `app/` avant de changer une signature.
- Après : `node --test`, puis vérification minimale (section Lancement) — y compris l'impression et la largeur iPhone, les zones les plus fragiles.

### 8. Git — commits atomiques
Format existant de l'historique : `type(scope): description courte en français` (`feat`, `fix`, `refactor`, `style`, `docs`, `chore`).

```
fix(recap-annuel): calcul réel de l'abattement depuis le storage
fix(config): SMIC 2023 corrigé à 11,27 (valeur au 1er janvier)
chore(render): suppression du doublon year-abattement.js
```

Un commit = un changement logique. Ne pas mélanger refactor et fix.
