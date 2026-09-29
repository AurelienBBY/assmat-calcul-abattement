# Feuille de route — Assmat Calcul abattement

Mise à jour : 2026-09-29. Ce document fixe **où on va et pourquoi**. Le « comment coder » vit dans `CLAUDE.md` ; ici on ne liste que les objectifs et les décisions produit.

## Cap produit

Outil pour **une utilisatrice unique** : assistante maternelle employée par un CCAS (donc **hors Pajemploi** — aucun récapitulatif fiscal fourni, le calcul de l'abattement depuis les temps de présence réels est entièrement à sa charge). Critères directeurs, dans l'ordre :

1. **Fiabilité du calcul** — c'est un chiffre reporté sur une déclaration fiscale.
2. **Saisie minimale** — utilisatrice non technicienne, geste mensuel qui doit rester court.
3. **Hors-ligne, zéro dépendance, données locales** — décision ferme (voir CLAUDE.md).
4. **Documents imprimables crédibles** — le PDF annuel est le vrai livrable de l'outil.

Cible de distribution : **GitHub Pages + PWA** (lot 6) — elle a un raccourci, toujours la dernière version, données toujours dans son navigateur.

## Lot 1 — Fiabilité (P0) — ✅ fait le 2026-07-19

- ✅ `app/lib/compute/year-recap.js` réécrit : abattement réel via `S.loadMonth` + `C.computeMonthTotal` (smicOverride du mois pris en compte), compteurs J<8h/J≥8h, statuts corrects. Vérifié par harnais node (15 assertions sur les vrais fichiers).
- ✅ `config.js` : SMIC 2023 = 11,27.
- ✅ `90-print.css` commité ; dossier « copy » sorti du dépôt (archivé sur le Bureau).
- ✅ Nettoyage — avec une découverte : c'était `rules.js` qui n'était **pas chargé** (le `<script>` pointait sur `year-abattement.js`, d'où une explication affichée en double à l'écran). Bascule sur `rules.js` (+ typo corrigée), suppression de `year-abattement.js`, sentinel `#period-sentinel` corrigé dans app.js, garde utils réelle dans `render/index.js`.

## Lot 2 — Moteur unifié — ✅ fait le 2026-07-19

**Pourquoi** : deux chemins de calcul (mensuel = DOM, annuel = localStorage) ont déjà divergé une fois. Une seule source de vérité rend la divergence impossible.

- ✅ `state.data` → `calc.js` → rendu : le DOM n'est plus jamais lu pour calculer (invariant inscrit dans CLAUDE.md).
- ✅ Suite `node --test` (21 tests, zéro dépendance) : calc (bornes 8 h, prorata, invalides), storage (imports malformés, aller-retour export/import d'année), récap annuel.
- ✅ Export/import **annuel** : format `abmat-year`, un fichier par année (`abattement-assmat-2026.json`), mois vides exclus ; l'import accepte aussi les anciens fichiers de mois (depuis le RÉCAP, bascule sur le mois du fichier). Le **profil** (« Mes informations », lot 5) sera ajouté à cette enveloppe. Rappel décisions : JSON = format machine, PDF = format humain ; ~30 Ko/an, aucune limite pratique.
- ✅ Bouton Sauvegarder en mode RÉCAP corrigé (il exporte l'année affichée, plus un fichier `null`).

## Lot 3 — Interface — ✅ fait le 2026-07-19 (3 étapes)

**1)** schéma v2 + moteur (multi-créneaux, absences, migration auto) ; **2)** nouveau tableau de saisie (enfants visibles, + créneau, absence + motif, fériés, recopie de semaine, total du jour ; valeurs remplies depuis l'état, jamais d'innerHTML sur les données) ; **3)** thème (accent #23458c, base 17 px, héros + « au lieu de X € perçus », « ✓ Enregistré » + total du mois dans la toolbar, tuto replié après 1re visite, années en pastilles fixes 2023 → courante). ⚠️ Vérification navigateur des étapes 2–3 encore due par l'utilisateur. Les **prénoms des enfants** restent affichés « Enfant 1/2/3 » jusqu'au profil du lot 5 (le renderer accepte déjà `childNames`).

**Pourquoi** : la page met la pédagogie avant la tâche, le tableau affiche 3 lignes/jour même pour 1 enfant, et l'autosave est invisible (angoisse pour une non-technicienne).

- Réorganiser autour du geste mensuel : choisir le mois → saisir → vérifier. Tuto et explication repliés après la première visite.
- Tableau : **1 ligne par jour** + bouton « + enfant » ; **prénoms des enfants** à la place d'« Enfant 1/2/3 » ; jours fériés marqués ; « recopier la semaine précédente ».
- **Plusieurs créneaux par enfant et par jour (décision 2026-07-19)** : un « + » discret à côté de l'horaire ajoute un 2ᵉ créneau (ex. départ chez le médecin puis retour). Calcul : les heures des créneaux **s'additionnent sur la journée**, puis la règle ≥ 8 h / prorata s'applique au total — fiscalement exact. Nécessite le schéma de données v2 (tableau de créneaux par enfant) avec migration dans `normalizeData()`.
- **Absence avec motif (décision 2026-07-19)** : un enfant peut être marqué « Absent » sur un jour, avec motif optionnel (malade / congés / autre). Pas d'abattement ce jour-là, mais on distingue « rien saisi = oubli » de « absent = volontaire » — statuts plus justes et relevés plus crédibles.
- **Heures au format français (décision 2026-07-19)** : « 8h30 » partout à l'affichage (tableaux, durées, PDF). Le **champ de saisie** reste un `<input type="time">` natif (affiché « 08:30 » par le navigateur) : c'est lui qui rend les fautes de frappe impossibles et donne le bon clavier sur téléphone — compromis assumé, à réévaluer seulement si l'utilisatrice bute dessus.
- Une **couleur d'accent** unique ; le montant à déclarer en héros visuel ; typo base 16-17 px ; contrastes AA.
- Signal « ✓ Enregistré » visible ; total du mois affiché dans la toolbar sticky.
- Borne d'années fixe (2023 → année courante) au lieu de ±3 ans glissants.

**Méthode** : maquette HTML d'abord (artifact), validée par l'utilisatrice finale avant de toucher au code.

## Lot 4 — PDF — ✅ fait le 2026-07-19

- ✅ **Gabarit dédié** `#print-doc` généré en JS (bouton Imprimer + `beforeprint` pour Cmd+P) ; l'app entière est masquée à l'impression. Pas de lib PDF.
- ✅ **Deux documents** : relevé mensuel (semaines → enfants → créneaux « 8h30 – 17h30 », absences motivées, fériés, sous-totaux, synthèse + règles) et récap annuel (encadré **case 1AJ** en tête, 12 mois, mémo, mention « conservez les relevés en annexe »). En-tête d'identité branché sur `abmat:profile` (fallback générique tant que le lot 5 n'est pas fait). Modèle mensuel testé (`compute/month-print.js`).
- ✅ **On imprime ce qu'on regarde** (décision 2026-07-19) : relevé du mois en Déclaration, récap de l'année en Ma déclaration. « Imprimer le dossier complet de l'année » (relevés renseignés + récap, sauts de page) : fait au lot 10.

## Lot 5 — Parcours utilisateur — ✅ cœur fait le 2026-07-19

Livré : onglet **MES INFOS** (identité + enfants avec prénoms/désactivation + **semaine type par enfant**, un créneau par jour), **pré-remplissage d'un mois vide** en un clic (volontaire, fériés/week-ends exclus, `compute/prefill.js` testé), profil dans l'export/import d'année, **encart « Case 1AJ »** et **comparaison des régimes** à l'écran du RÉCAP, ⚠︎ expliqué au survol, héros signalant une fiche de paie manquante. Reste du lot (différé) : rappel d'export en fin d'année, annulation (« toast Annuler ») après recopie/pré-remplissage/import, état vide guidé vers MES INFOS, statut « Congés ? » au récap.

Périmètre d'origine :

- **« Mes informations »** (saisie unique) : son nom, le CCAS, prénoms des enfants — personnalise saisie et PDF. **Décisions (2026-07-19)** : ce n'est pas une « page de paramétrage » technique mais une petite fiche (3 champs + liste des enfants avec possibilité de désactiver un enfant parti). Stockage dans une clé dédiée `abmat:profile`, incluse dans l'export annuel. La table des SMIC reste dans `config.js` (mise à jour par le mainteneur, 1×/an) — l'override manuel ne sert que si l'année manque.
- **Encart « Ma déclaration »** dans le récap annuel : le montant et la case exacte (traitements et salaires, 1AJ), avec la consigne de remplacer le montant prérempli.
- **Comparaison des deux régimes** (salaires seuls vs tout + abattement) : vérifie chaque année que l'option est gagnante. Prudence : structure des indemnités en CCAS à valider sur ses fiches de paie.
- Rappel d'export en fin d'année ; statut « Vide » non alarmant pour un mois de congés.

## Lot 6 — Distribution & vraie sauvegarde — ✅ COMPLET le 2026-07-19

**✅ En ligne : https://aurelienbby.github.io/assmat-calcul-abattement/** — hébergement **GitHub Pages** finalement retenu (décision utilisateur du 2026-07-19 : plus rapide que le sous-domaine ; repo passé en public — il ne contient aucune donnée personnelle ; déploiement automatique à chaque push sur `main`). Le sous-domaine perso reste le plan B documenté ci-dessous.
**✅ PWA** : `index.html` (renommage), `manifest.webmanifest`, `sw.js` (réseau d'abord / cache en secours → mises à jour instantanées en ligne, app complète hors-ligne), icônes, `storage.persist()`.
**✅ Fusion multi-appareils** (voir section Multi-appareils) : `mergeYearFromJsonText`, horodatage au contenu, arbitrage des conflits — testée (44 tests).
**✅ Étape 3** : auto-sauvegarde dans un dossier (module `app/lib/autosave.js`, File System Access API, poignée en IndexedDB) — écriture à chaque modification + relecture/fusion au démarrage et au changement d'année ; pilule d'état cliquable « Fichier à jour ✓ / ⚠ Activer la sauvegarde auto » ; bannière de restauration sur appareil sans données ; sur iOS le bouton Sauvegarder ouvre la feuille de partage (→ Fichiers/OneDrive). **Jour de l'installation chez l'utilisatrice : cliquer la pilule et choisir le dossier OneDrive** — c'est le seul geste de configuration.
- **CMS / base / identification rejetés (décision 2026-07-19)** : un Drupal + BDD + login inverserait la sécurité — données personnelles exposées en ligne, surface d'attaque permanente, patchs de sécurité à vie, RGPD, mot de passe à gérer — pour un bénéfice nul face à l'auto-sauvegarde OneDrive déjà décidée. Un serveur ne redeviendrait pertinent que si l'outil devenait **multi-utilisatrices**, et ce serait alors une petite API de sync sur mesure, pas un CMS.
- Ajouter manifest + service worker (**PWA**) : raccourci bureau/téléphone, hors-ligne conservé, mises à jour automatiques, données jamais en ligne.
- **Résilience au « nettoyage » (décision 2026-07-19)** : le stockage navigateur meurt si Chrome est désinstallé ou nettoyé (CCleaner, « effacer les données ») — `storage.persist()` ne protège pas d'une suppression volontaire. Le filet est le **fichier auto-sauvegardé** (OneDrive), toujours à jour. Deux garde-fous à livrer : **écran de restauration** au premier lancement à vide (« Restaurer depuis une sauvegarde » en évidence, au lieu d'un tableau vierge muet) et **indicateur de sauvegarde fichier** dans la toolbar (« Fichier à jour ✓ » / « Dossier non configuré ⚠ »).
- **`navigator.storage.persist()`** : stockage local déclaré persistant (plus de risque d'éviction navigateur).
- **Auto-sauvegarde (décision 2026-07-19)** : via la **File System Access API** (Chrome/Edge), l'outil demande une fois un dossier de sauvegarde puis y écrit `abattement-assmat-AAAA.json` automatiquement à chaque modification. Si le dossier est synchronisé (iCloud Drive / Google Drive), la copie hors machine est assurée **par l'OS** — notre code ne touche jamais au réseau. Repli Safari/Firefox : export manuel actuel + rappel périodique. Le JSON reste LE format de sauvegarde (ouvert, ré-importable, pérenne) — c'est le *geste* qui devient automatique, pas le format qui change.
- **Décision d'architecture (2026-07-19)** : pas d'app native (Electron/Tauri) — la signature/notarisation, la distribution et les mises à jour coûteraient sans rien apporter que la File System API ne donne déjà.
- **Appareils de l'utilisatrice (confirmés 2026-07-19)** : PC **Windows** (Chrome/Edge → auto-sauvegarde complète, dossier **OneDrive** recommandé — il a une app iPhone et fait le pont) + **iPhone** (PWA installable, hors-ligne, mais **pas d'écriture automatique de fichiers sur iOS**).

### Multi-appareils : saisie libre PC ↔ iPhone (décision finale 2026-07-19)

**Principe retenu : le fichier OneDrive est le point de rencontre, et l'import est une FUSION par mois horodatés** (remplace les anciens modèles A/B). Chaque mois et le profil portent un `updatedAt` posé à chaque modification ; à la lecture d'un fichier, la version la plus récente gagne **mois par mois** — un oubli de synchronisation ne détruit plus rien. Seul conflit restant : le même mois modifié sur les deux appareils sans synchro intermédiaire → **question explicite** (« garder la version du téléphone ou de l'ordinateur ? », avec dates), jamais d'écrasement silencieux.

- **PC (Chrome/Edge)** : invisible — lecture + fusion du fichier OneDrive à l'ouverture, écriture à chaque modification (File System Access API).
- **iPhone (PWA)** : deux gestes guidés, incompressibles sur iOS — « Reprendre la dernière sauvegarde » (sélecteur de fichiers → OneDrive, fusion) à l'arrivée, « Envoyer ma saisie » (feuille de partage → remplacer le fichier OneDrive) en partant. Rappels dans l'UI : synchro ancienne à l'ouverture, modifications non envoyées en quittant.
- La fusion horodatée sert aussi le mono-appareil (une restauration ne peut plus régresser des données) → **à construire d'office au lot 6**, logique de fusion pure et testée.
- **Serveur de synchronisation toujours rejeté** ; ne serait rediscuté (mini-API chiffrée sur mesure, jamais un CMS) que si la friction des 2 gestes iPhone se révélait bloquante à l'usage réel.

## Lot 8 — Redesign visuel "Liquid Glass" — ✅ fait le 2026-07-19

**Origine** : handoff externe préparé par l'utilisateur (`handoff_liquid_glass/` à la racine du repo — maquettes HTML + README détaillé, teinte Prune et intensité Médium déjà validées en amont). Détail technique complet dans `CLAUDE.md` (section « Design Liquid Glass »).

- ✅ Système de tokens oklch (`00-vars-base.css`) — glass/glass-strong, btn, pill — noms de variables historiques conservés (aucune régression CSS ailleurs).
- ✅ Toolbar consolidée : bouton « Données » (menu Sauvegarder/Importer/sauvegarde auto), icône « Mes informations » sortie de la barre des mois, icône Imprimer généralisée (peut exister à 2 endroits).
- ✅ Navigation : années en pastilles verre, mois en rangée scrollable avec dégradés de bord.
- ✅ Tableau mensuel réécrit en cartes glass (`day-rows.js`/`month-table.js`), contrat `data-*` strictement conservé — zéro changement dans les handlers de calcul d'`app.js`. 44 tests toujours verts.
- ✅ Tous les écrans restants reskinnés (héros, récap annuel + tableau propre indépendant, Mes informations, tuto/modale, paramètres SMIC, fiche de paie).
- ✅ Icônes et `theme-color` de la PWA alignés sur la teinte Prune.
- ✅ PDF et impression **non touchés** (décision du handoff).
- ⚠️ **Vérification navigateur non encore faite par l'utilisateur** — c'est le plus gros changement DOM du projet après le tableau v2 du lot 3.

## Lot 9 — Navigation à 3 piliers — ✅ fait le 2026-07-19

**Origine** : retour utilisateur après la première maquette Accueil — question de fond sur le parcours utilisateur (« accueil, inscription des informations, infos déclarative »). Deux maquettes de validation avant code (écran Accueil seul, puis navigation complète à 3 onglets). Détail technique complet dans `CLAUDE.md` (section « Navigation à 3 piliers »).

- ✅ **Accueil** (nouveau pilier, `render/accueil.js`) : message de bienvenue toujours affiché en premier (retour utilisateur explicite — ne pas enchaîner directement sur une invitation à agir), puis 3 raccourcis adaptés à l'état du profil. Héberge le tutoriel et l'explication des règles, relocalisés depuis les vues mensuelles (ne se répètent plus à chaque mois) et plus jamais repliés (Accueil n'est pas une page récurrente à condenser).
- ✅ **Mes informations** devient sa propre section pleine largeur (`#infos-section`), plus cohérent qu'imbriqué dans la colonne résultat de Déclaration.
- ✅ **Déclaration** regroupe ce qui existait (années/mois/RÉCAP, tableau, fiche de paie, résultat) — la sous-navigation années/mois n'apparaît plus que sous ce pilier.
- ✅ Toolbar simplifiée à 3 onglets texte (au lieu d'icônes) + Imprimer masqué hors Déclaration (aucune cible valable sur Accueil/Infos) + Données toujours global.
- ✅ **Années déclarées** : case à cocher manuelle dans le récap annuel (pas une date calculée — les fenêtres de déclaration varient chaque année) → badge ✓ sur la pastille d'année. Volontairement hors export/merge (repère local, pas une donnée fiscale).
- ✅ Pilier mémorisé (`abmat:ui:pillar`) : Accueil par défaut sur un appareil vierge, Déclaration sinon (n'interrompt pas une habitude déjà prise après mise à jour de l'outil).
- ✅ Nettoyage : `explain.js` perd un paramètre mort depuis l'origine ; le mécanisme de pliage première-visite (`abmat:ui:visited`) est retiré, devenu sans objet.
- 48 tests verts (dont 4 nouveaux pour les années déclarées). ⚠️ **Vérification navigateur non encore faite** — changement de navigation structurel, à tester en priorité (les 3 onglets, le contexte adaptatif d'Accueil selon le profil, le badge déclarée).

## Lot 10 — 4ᵉ pilier « Ma déclaration » + dossier complet — ✅ fait le 2026-07-21

**Origine** : retour utilisateur après validation du lot 9 — le RÉCAP, enterré comme 13ᵉ onglet de Déclaration, méritait sa propre destination avec des résultats bien visibles. Discussion en plusieurs temps (nom du pilier, style de navigation par année, portée du dossier complet), tranchée avant code : **« Ma déclaration »**, mêmes pastilles d'années qu'aujourd'hui, **dossier complet inclus dans ce lot** (pas différé). Maquette artifact validée avant implémentation. Détail technique complet dans `CLAUDE.md` (section « Navigation à 4 piliers »).

- ✅ **Promotion du RÉCAP** : contenu strictement inchangé (encart 1AJ, détail par mois cliquable, comparaison des régimes — `render/year-recap.js` non touché), retiré de la sous-navigation de Déclaration (`period.js`), déplacé dans son propre pilier `#ma-declaration-section` avec un sélecteur d'années dédié sans onglets de mois (`R.renderYearOnlySelector`, nouveau, dans `period.js`). Année partagée avec Déclaration (`state.year`) — clic sur un mois du tableau renvoie l'éditer dans Déclaration, comme avant.
- ✅ **Dossier complet** : bouton dédié « Imprimer le dossier complet » (texte dynamique : compte les mois renseignés) assemblant récap annuel + relevés des mois non vides, un par page (nouveau `render/print-full-year.js`, réutilise tel quel `print-year.js`/`print-month.js` refactorés pour exposer un « builder » de feuille séparé de leur rendu direct dans `#print-doc`). `Compute.forfaitJourForMonth` exposé (déjà utilisé en interne par le récap) pour que chaque relevé du dossier respecte un `smicOverride` propre à son mois.
- ✅ Toolbar à 4 onglets ; icône Imprimer visible sous Déclaration **et** Ma déclaration (relevé du mois ou récap seul — le dossier complet a son propre bouton, non concerné par cette icône).
- ✅ Simplification : `state.pillar` porte maintenant toute la logique de vue (plus de sentinel `monthIndex===12`) ; `#content-grid` n'a plus qu'un seul mode d'affichage (`.content-grid--single` retirée avec le récap qui la justifiait).
- ✅ 48 tests toujours verts (aucune logique pure nouvelle, seulement une fonction existante exposée). Vérifié en Chrome headless piloté par CDP (script Node jetable, sans dépendance ajoutée au projet) : 4 onglets, changement d'année dans Ma déclaration, clic sur un mois (retour en Déclaration), case « déclarée », impression simple et dossier complet multi-pages — zéro exception JS.

## Lot 11 — Onboarding (3 piliers) + fiche de référence — ✅ fait le 2026-07-21

**Origine** : « faudrait un vrai onboarding à la place du tuto tout moche » — l'ancien tutoriel (liste à puces sur Accueil + modale en mur de texte légal) explique mal et ne se relie à rien de visible à l'écran. Deux maquettes de validation avant code : d'abord un concept de coachmarks pointant les champs réels de la saisie mensuelle, écarté par l'utilisateur au profit d'un explicatif directement sur Accueil, racontant l'enchaînement des piliers dans l'ordre d'usage — plus simple à construire (pas de positionnement dynamique sur des éléments réels) et plus robuste. Détail technique complet dans `CLAUDE.md` (section « Onboarding »).

- ✅ **`render/onboarding.js`** (nouveau) : 3 cartes reliées par des flèches sur Accueil — Mes informations → Déclaration → Ma déclaration, mêmes icônes que les raccourcis existants. Toujours affichée ; l'étape 1 se met en avant (bordure verte) uniquement tant que le profil est vide, seule action possible à ce stade.
- ✅ **Fiche de référence** (`app/modals/reference.html`, renommé depuis `tuto.html`) réécrite en cartes (icône, titre, texte court, encarts d'alerte) au lieu du mur de texte — et **mise à jour au passage** : le contenu original décrivait un export par mois (obsolète depuis le lot 2) et ne mentionnait ni la sauvegarde automatique (lot 6) ni le dossier complet (lot 10) ; la nouvelle fiche reflète l'état réel de l'outil.
- ✅ Bouton renommé « Voir les points d'attention » (`[data-open-tuto]`), ouvert soit depuis le bloc onboarding, soit depuis la carte « book » des raccourcis (profil vide). **Piège corrigé** : ce bouton vit maintenant dans du contenu recréé à chaque affichage d'Accueil — `initTutoModal()` et le chargement paresseux de l'iframe sont passés d'un binding direct (posé une fois, perdu à la recréation) à une **délégation d'événement sur `document`**.
- ✅ Nettoyage : `app/style.css` (739 lignes mortes depuis le tout premier commit, jamais chargé par `index.html`) supprimé.
- ✅ 48 tests toujours verts (aucune logique pure touchée). Vérifié en Chrome headless CDP : les 3 étapes, la bascule de mise en avant profil-vide → profil-rempli (via la vraie saisie du champ nom, pas un contournement du storage), l'ouverture de la fiche par les deux chemins, le contenu de l'iframe (10 cartes, 4 sections) — zéro exception JS.

## Corrections P0 de la revue — ✅ faites le 2026-09-29

Suite de `docs/revue-2026-09-29.md`, avant toute nouvelle fonction :

- ✅ **Case 1AJ calculée sur l'année** : total perçu − abattement annuel, plancher à 0 appliqué une seule fois. Le récap additionnait des mois plafonnés à 0 et perdait l'abattement des mois où il dépasse la paie (versements décalés, 3 enfants à temps plein). Le solde d'un mois peut désormais être négatif (affiché, expliqué). Le test annuel existant figeait l'erreur ; 2 tests ajoutés.
- ✅ **Dossier complet** : il n'imprimait que le récap (`beforeprint` le reconstruisait) — vérifié avec le vrai `window.print()` de Chromium.
- ✅ **Montants de la fiche de paie** en champs texte, virgule ou point, montant compris réaffiché, saisie ambiguë refusée (`U.parseMoneyFR`, 2 tests).
- ✅ **Défauts visuels** : icônes géantes des boutons, cartes de Ma déclaration, défilement horizontal sur iPhone (onglets en 2 × 2), JUIN/JUIL.
- ✅ **Textes** : case 1AJ ou 1BJ ; fiche de référence (IRF, heures de présence, versements décalés).
- Reste à confirmer sur impots.gouv avant la campagne 2027 : la case dédiée au montant de l'abattement (1GA/1HA) citée par plusieurs guides.

## Lot 12 — Refonte « calendrier » + pointeuse — ✅ fait le 2026-09-29

**Réalisé** (branche `claude/review-abattement-fiscal-tool-lamcwx`) : données v3 et migrations, heures supplémentaires expliquées, puis nouvelle interface à 4 onglets conforme à la maquette (pointeuse, calendrier par exceptions, fiche du jour, semaine de congés, 3 étapes du mois, Mon année avec « Préparer AAAA », Mon profil avec enfants datés et horaires « à partir du … », copie iCloud avec rappels iPhone, effacer une année). Décisions prises en cours de route :
- un **jour pointé n'est jamais touché** par une action de masse (semaine de congés, journée habituelle) : ses heures sont réelles ;
- la pointeuse compte une **réunion en cours** jusqu'à l'heure actuelle ; sans heure actuelle (calcul du mois), une réunion sans fin reste « à vérifier » ;
- l'onglet de départ n'est pas mémorisé : **Aujourd'hui** sur téléphone et au premier lancement, **Mon mois** sur ordinateur ;
- design **opaque** (fin du verre « Liquid Glass ») et mode sombre automatique.

**Reste à faire (suite du lot)** : fusion **jour par jour** plutôt que mois par mois ; sur ordinateur, fusionner puis supprimer les doublons « abattement-assmat-AAAA 2.json » créés par erreur ; rappel d'envoi après un changement important du profil ; heures sup. dans le relevé imprimé ; arbitrage d'un conflit de fusion dans une fenêtre de l'outil (aujourd'hui `confirm()`).

### Proposition initiale (2026-09-29)

**Origine** : revue complète du 2026-09-29 (`docs/revue-2026-09-29.md`) — pages trop longues, 22 cartes de jours à parcourir chaque mois. Maquette cliquable validée par l'utilisateur (artifact privé « Calendrier Ass-Mat », v2), puis décisions ci-dessous.

- **Navigation** : 4 onglets — **Aujourd'hui** (pointeuse), **Mon mois** (calendrier), **Mon année** (montant à déclarer, passage d'année), **Mon profil**. Barre d'onglets en bas sur iPhone. L'actuel Accueil ne sert plus qu'au premier lancement.
- **Mon mois = saisie par exceptions** : calendrier pré-rempli avec les horaires habituels ; un clic ouvre la fiche du jour (« Journée habituelle », « Je n'ai pas travaillé », présence/absence par enfant, 2ᵉ horaire, réunion, détail des heures sup.) ; « Semaine de congés » par semaine ; « Annuler » après chaque action de masse. Chaque mois = 3 étapes (vérifier les jours, recopier la fiche de paie, « Terminé ») ; la copie de secours est proposée à chaque « Terminé ».
- **Pointeuse (Aujourd'hui)** : « Arrivée » / « Départ » par enfant à l'heure du téléphone, « Pas là aujourd'hui », « Début / Fin de réunion », heures corrigeables au toucher, explication des heures sup. en direct. Les jours pointés sont justes par construction (pas à re-vérifier).
- **Enfants (décision 2026-09-29)** : liste **datée** (date d'arrivée, date de départ facultative), **autant d'enfants que nécessaire sur l'année, 4 au maximum présents en même temps** (confirmé le 2026-09-29 : c'est la présence simultanée qui compte, pas le nombre d'enfants dans la journée ; remplace « hors périmètre : plus de 3 enfants par jour »). **Horaires habituels versionnés** (« à partir du … ») : un changement ne modifie **jamais** un jour pointé, modifié à la main, ou d'un mois terminé — seuls les jours encore « comme d'habitude » d'un mois non terminé après la date d'effet sont mis à jour. L'historique reste visible dans le profil.
- **Accueil relais (décision 2026-09-29, confirmée)** : case à cocher **par année** (« Je fais de l'accueil relais en AAAA »). Elle ajoute « + Enfant en accueil relais » dans la fiche du jour et la pointeuse (prénom saisi ce jour-là, sans semaine type). Ces enfants comptent dans l'abattement comme les autres et dans la limite de 4 présents en même temps.
- **Profil (décision 2026-09-29)** : prénom, nom, employeur, modifiables ; **plus de n° d'agrément** ni de champ « mention ».
- **SMIC par année (décision 2026-09-29, remplace « consultable, jamais modifiable » du 2026-07-19)** : réglé au **passage d'année** dans un écran « Préparer AAAA » (1. SMIC horaire brut au 1er janvier, pré-rempli si l'outil le connaît, avec contrôle de vraisemblance et aperçu du forfait ; 2. enfants qui continuent ; 3. accueil relais). **Un seul SMIC par année** : fin du `smicOverride` mensuel (cf. revue, point C5). L'année précédente reste accessible pour la déclaration du printemps.
- **Heures supplémentaires** : règle validée et explication jour par jour, voir `docs/spec-heures-supplementaires.md`. Une réunion un jour sans enfant compte en heures supplémentaires (décision 2026-09-29) — il faudra donc pouvoir saisir une réunion un samedi.
- **Modèle de données v3** (à concevoir et tester avant l'interface) : enfants du profil identifiés par un **id stable** (migration des clés `"1"`/`"2"`/`"3"` actuelles), périodes d'horaires datées ; par jour : `off` (non travaillé), `meetings`, enfants relais (prénom), marqueur « pointé » par enfant ; par mois : `verified`, `done` ; par année : `smic`, `relais`.
- **Sauvegarde / iPhone — iCloud Drive retenu (décision 2026-09-29)** : le fichier `abattement-assmat-AAAA.json` vit dans un dossier iCloud Drive. **PC** : « iCloud pour Windows » installé, ce dossier choisi une fois comme dossier de sauvegarde automatique (dossier réglé sur « toujours conserver sur cet appareil ») — lecture/fusion à l'ouverture et écriture à chaque modification, sans geste. **iPhone** : deux gestes guidés — « Envoyer ma copie » (feuille de partage → Enregistrer dans Fichiers → iCloud Drive → même dossier → remplacer) et « Reprendre la copie » (sélecteur de fichiers → fusion). Remplacer le fichier est sans risque grâce à la fusion horodatée. À ajouter : le PC fusionne aussi les doublons créés par erreur (« abattement-assmat-AAAA 2.json ») puis les supprime ; rappels « dernière copie il y a N jours » et copie proposée à chaque mois terminé ; fusion jour par jour plutôt que mois par mois. **CloudKit rejeté** : 99 €/an de compte développeur Apple pour une seule utilisatrice, plus une connexion Apple ID et des appels réseau.
- **Rappels sur iPhone (proposés le 2026-09-29, maquette v3, à valider)** — l'iPhone ne peut pas savoir seul si l'ordinateur a du nouveau, donc on lui **pose la question** plutôt que d'imposer un fichier à ouvrir. *Reprise* : à l'ouverture, au plus une fois par semaine, « Avez-vous saisi quelque chose sur l'ordinateur depuis le … ? » (Oui → reprendre la copie ; Non → plus de question pendant une semaine). *Envoi* : aux moments clés seulement — mois terminé (fenêtre), fin de journée pointée s'il y a au moins 3 jours non envoyés (simple message en bas), ouverture si la copie a plus de 7 jours (fenêtre), changement important du profil. « Plus tard » = 3 jours de calme. Garde-fous : au plus une fenêtre par jour, jamais deux à la suite, **jamais de fenêtre pendant qu'un enfant est pointé présent** (un bandeau non bloquant la remplace). Pastille permanente « N jours à envoyer » dans l'en-tête, qui ouvre « Envoyer ma copie » / « Reprendre la copie ». Sur l'ordinateur : aucun rappel (tout est automatique).
- **Ordre proposé** : 1) corrections P0 de la revue (case 1AJ annuelle, dossier complet, virgule, défauts visuels) ; 2) modèle v3 + migration + tests ; 3) calendrier et fiche du jour ; 4) heures sup. ; 5) pointeuse ; 6) passage d'année ; 7) sauvegarde iPhone (rappels, doublons, fusion par jour).

## Lot 13 — Mise en route guidée, photo de la fiche de présence, « Vérifier le mois » — ✅ fait le 2026-09-29

**Origine** : « un tuto complet avec une vraie phase d'initialisation », puis la photo de la fiche de présence rangée avec chaque mois, utile aussi hors mise en route pour reprendre un mois. Maquette cliquable validée (artifact privé « Mise en route Ass-Mat », v3). Décisions de l'utilisatrice : une seule fiche **recto verso** avec tous les enfants, photos **remplaçables** ; rappel si l'on termine un mois sans fiche ; zoom par pincement **et** ouverture directe sur la moitié de page ; question des enfants partis **à partir de février** ; **recto = du 1er au 15, verso = du 16 à la fin du mois**.

- ✅ **Mise en route** (premier lancement, plein écran sans onglets) : accueil (« J'ai déjà une copie de secours » → reprise, mise en route inutile), 1. Vous (nom des documents imprimés), 2. les enfants d'aujourd'hui (jours d'un toucher, mêmes horaires ou par jour, « Ses horaires ont changé depuis janvier / son arrivée » pour un enfant arrivé avant le mois en cours, départ prévu) puis ceux **partis depuis janvier**, 3. l'année (SMIC du 1er janvier confirmé d'un geste ou corrigé, accueil relais), 4. les mois passés (remplis avec les horaires habituels, chaque enfant entre ses dates, anciens horaires avant un changement — **seuls les mois vides**), 5. la copie de secours (premier envoi guidé sur iPhone, dossier sur ordinateur, « Je le ferai plus tard »), puis « C'est prêt » et le rythme d'utilisation. Tout est enregistré au fil de l'eau ; « Plus tard » → carte « La mise en route vous attend » sur Aujourd'hui ; « ? » → « Revoir la mise en route ».
- ✅ **Bulles d'aide** : une par onglet, le geste principal en une phrase, jusqu'à « Compris » (après la mise en route).
- ✅ **Photo de la fiche de présence** (Mon mois) : recto et verso, compressés (JPEG ≤ 1800 px), rangés dans IndexedDB, remplaçables, supprimables (avec « Annuler »), ouverts en grand avec zoom. Imprimés après le relevé du mois et dans le dossier complet (« l'original papier fait foi »). Copie de secours : fichier séparé `abattement-assmat-AAAA-fiches.json`, réécrit/envoyé seulement quand une photo change, fusionné photo par photo. Effacés avec l'année.
- ✅ **Vérifier le mois** (plein écran) : une semaine à la fois, la photo à côté (au-dessus sur iPhone) ouverte sur la bonne face et la bonne moitié (selon le jour du milieu de la semaine, modifiable) ; toucher un jour ouvre sa fiche du jour ; les jours corrigés sont marqués ; à la fin, l'étape 1 du mois est cochée.
- ✅ **« J'ai terminé » sans aucune photo** : rappel non bloquant (« Joindre la fiche » / « Terminer quand même »).
- ✅ **Ajusté sur une vraie fiche** (recto de septembre 2025) : un jour par **colonne** (week-ends compris), par enfant une ligne A et une ligne D aux **heures réelles à la minute**, horaires du contrat écrits sous le prénom, lignes IRF, accueil relais et heures supplémentaires. D'où : photo **redressée** (prise en portrait → quart de tour à gauche, « Tourner » sinon), vérification **zoomée sur les colonnes de la semaine** (au lieu de « haut / bas », qui ne tombait juste que photo de travers), la semaine de l'outil **disposée comme la fiche** (A / D par enfant, un jour par colonne), cases à vérifier **à la minute** signalées (moins de 8 h 15 prévues, journée proche de 10 h — au-delà de 8 h, quelques minutes ne changent rien), heures sup. calculées rappelées en fin de vérification. Enseignement : les périodes d'**adaptation** (demi-journées) s'écartent beaucoup du contrat ; laissées « comme d'habitude », elles gonfleraient l'abattement de 20 à 27 € par jour.
- ✅ **Photo depuis l'album de l'iPhone** (retour de test sur l'iPhone) : photos rangées en octets et non en Blob (Safari), champs de fichier présents mais invisibles, délais et messages à chaque étape — confirmé qui fonctionne sur l'iPhone.
- ✅ **« Tout effacer sur cet appareil »** (Mon profil, décision 2026-09-29) : pour repartir de zéro sans passer par les réglages de l'iPhone. Avertit si la copie de secours n'est pas à jour (« Envoyer ma copie d'abord »), confirmation en deux temps, puis mise en route. La copie de secours n'est jamais touchée.
- ✅ **Nom « AB’assmat »** (décision 2026-09-29) : sous l'icône de l'écran d'accueil (iPhone et Android), dans l'en-tête et le titre. Les fichiers de copie gardent leur nom.
- ✅ **« Installez d'abord AB’assmat »** (décision 2026-09-29) : écran avant la mise en route, sur téléphone seulement — sur iPhone, l'icône a sa propre mémoire, il faut donc installer avant de saisir. Gestes Safari illustrés ; bouton d'installation Android.
- ✅ **Logo** (décision 2026-09-29) : le biberon-horloge, dessiné à la main dans l'esprit d'illustrations à l'encre (trait noir, aplats crème décalés, fonds pastel), sur fond **mauve** (lien avec le Prune de l'outil). Partout : icône iPhone, Android (version adaptable), onglet, en-tête, accueil de la mise en route, écran d'installation. Les téléphones déjà équipés gardent l'ancienne icône jusqu'à ce qu'on la réinstalle.
- **Écarté** : lecture automatique (OCR) des fiches manuscrites — erreurs silencieuses, cf. lot 7. Les scans PDF ne sont pas acceptés (il faudrait une bibliothèque de lecture PDF) : une photo suffit.

## Lot 7 — Pièces justificatives (décidé le 2026-07-19) — ✅ réalisé autrement au lot 13

> Réalisé au lot 13 : photos de la fiche uniquement (pas de PDF), dans un **fichier de copie séparé** (le fichier de l'année reste léger et se réécrit à chaque modification), et vis-à-vis dans « Vérifier le mois ». Texte d'origine conservé ci-dessous.

**Besoin** : les heures proviennent d'une fiche papier signée par les parents ; en cas de contrôle il faut retrouver, par mois, le calcul ET la pièce signée.

- **Archivage local de la fiche signée** (photo JPG ou PDF) attachée au mois : bouton « Joindre la fiche signée » dans la section Déclaration. **Compression à l'attache** (canvas natif, ~1600 px JPEG → 200-400 Ko ; PDF acceptés tels quels avec plafond ~2 Mo). Stockage de travail en **IndexedDB** (100 % local, pas de limite 5 Mo). Pièce visible, téléchargeable, remplaçable.
- **Une seule sauvegarde (décision 2026-07-19)** : grâce à la compression, les pièces **voyagent dans le JSON annuel** (base64, ~3-5 Mo pour 12 mois) — pas de double geste d'export, la restauration « nouvel ordinateur » ramène chiffres + profil + pièces d'un seul fichier. L'UI rappelle que **la fiche papier signée reste l'original probant** ; l'archive numérique est une copie de travail.
- **Saisie en vis-à-vis** : la fiche jointe s'affiche à côté du tableau pendant la saisie — recopie des exceptions sans jongler papier/clavier.
- **OCR écarté (décision)** : fiches manuscrites → reconnaissance peu fiable (erreurs silencieuses = risque fiscal inacceptable), problème déjà résolu à 90 % par les semaines types, et dépendance lourde contraire à la règle zéro dépendance. Révisable uniquement si les fiches deviennent imprimées/dactylographiées — et même alors, avec écran de vérification obligatoire.
- Point d'attention : les pièces ne voyagent PAS dans l'export JSON annuel (taille) — prévoir leur téléchargement séparé et le documenter dans l'UI.

## Différé / décisions en attente

- ~~Garde en deux fois~~ → **tranché le 2026-07-19** : multi-créneaux par enfant/jour (voir lot 3).
- ~~**SMIC : consultable, jamais modifiable** (décision 2026-07-19)~~ → remplacé au lot 12 par le réglage du SMIC au passage d'année (« Préparer AAAA », pré-rempli par le barème de `config.js` quand il connaît l'année, avec contrôle de vraisemblance).
- ~~Samedi travaillé, 4ᵉ enfant~~ → **tranché au lot 12** : jusqu'à 4 enfants présents en même temps ; samedi saisissable (réunions).
- Design system Claude Design (claude.ai/design) : optionnel, seulement si on veut itérer visuellement sur les composants ; la maquette artifact suffit pour ce projet.
