# Feuille de route — Assmat Calcul abattement

Mise à jour : 2026-07-21. Ce document fixe **où on va et pourquoi**. Le « comment coder » vit dans `CLAUDE.md` ; ici on ne liste que les objectifs et les décisions produit.

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

## Lot 7 — Pièces justificatives (décidé le 2026-07-19, à faire après le lot 6)

**Besoin** : les heures proviennent d'une fiche papier signée par les parents ; en cas de contrôle il faut retrouver, par mois, le calcul ET la pièce signée.

- **Archivage local de la fiche signée** (photo JPG ou PDF) attachée au mois : bouton « Joindre la fiche signée » dans la section Déclaration. **Compression à l'attache** (canvas natif, ~1600 px JPEG → 200-400 Ko ; PDF acceptés tels quels avec plafond ~2 Mo). Stockage de travail en **IndexedDB** (100 % local, pas de limite 5 Mo). Pièce visible, téléchargeable, remplaçable.
- **Une seule sauvegarde (décision 2026-07-19)** : grâce à la compression, les pièces **voyagent dans le JSON annuel** (base64, ~3-5 Mo pour 12 mois) — pas de double geste d'export, la restauration « nouvel ordinateur » ramène chiffres + profil + pièces d'un seul fichier. L'UI rappelle que **la fiche papier signée reste l'original probant** ; l'archive numérique est une copie de travail.
- **Saisie en vis-à-vis** : la fiche jointe s'affiche à côté du tableau pendant la saisie — recopie des exceptions sans jongler papier/clavier.
- **OCR écarté (décision)** : fiches manuscrites → reconnaissance peu fiable (erreurs silencieuses = risque fiscal inacceptable), problème déjà résolu à 90 % par les semaines types, et dépendance lourde contraire à la règle zéro dépendance. Révisable uniquement si les fiches deviennent imprimées/dactylographiées — et même alors, avec écran de vérification obligatoire.
- Point d'attention : les pièces ne voyagent PAS dans l'export JSON annuel (taille) — prévoir leur téléchargement séparé et le documenter dans l'UI.

## Différé / décisions en attente

- ~~Garde en deux fois~~ → **tranché le 2026-07-19** : multi-créneaux par enfant/jour (voir lot 3).
- **SMIC : consultable, jamais modifiable** (décision 2026-07-19) : le barème s'affiche en lecture seule dans « Mes informations » ; il est maintenu dans `config.js` (livré automatiquement via GitHub Pages une fois le lot 6 fait). La saisie manuelle n'apparaît que si l'année n'est pas encore dans le barème (début janvier) — un champ modifiable en permanence serait un risque d'erreur fiscale.
- Samedi travaillé, 4ᵉ enfant : hors périmètre tant que le besoin réel n'existe pas.
- Design system Claude Design (claude.ai/design) : optionnel, seulement si on veut itérer visuellement sur les composants ; la maquette artifact suffit pour ce projet.
