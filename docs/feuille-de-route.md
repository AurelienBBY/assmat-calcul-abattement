# Feuille de route — Assmat Calcul abattement

Mise à jour : 2026-07-19. Ce document fixe **où on va et pourquoi**. Le « comment coder » vit dans `CLAUDE.md` ; ici on ne liste que les objectifs et les décisions produit.

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
- ✅ **On imprime ce qu'on regarde** (décision 2026-07-19) : vue mensuelle → relevé du mois, vue RÉCAP → récap de l'année. Option ultérieure conservée : « Imprimer le dossier complet de l'année » (12 relevés + récap, sauts de page).

## Lot 5 — Parcours utilisateur — ✅ cœur fait le 2026-07-19

Livré : onglet **MES INFOS** (identité + enfants avec prénoms/désactivation + **semaine type par enfant**, un créneau par jour), **pré-remplissage d'un mois vide** en un clic (volontaire, fériés/week-ends exclus, `compute/prefill.js` testé), profil dans l'export/import d'année, **encart « Case 1AJ »** et **comparaison des régimes** à l'écran du RÉCAP, ⚠︎ expliqué au survol, héros signalant une fiche de paie manquante. Reste du lot (différé) : rappel d'export en fin d'année, annulation (« toast Annuler ») après recopie/pré-remplissage/import, état vide guidé vers MES INFOS, statut « Congés ? » au récap.

Périmètre d'origine :

- **« Mes informations »** (saisie unique) : son nom, le CCAS, prénoms des enfants — personnalise saisie et PDF. **Décisions (2026-07-19)** : ce n'est pas une « page de paramétrage » technique mais une petite fiche (3 champs + liste des enfants avec possibilité de désactiver un enfant parti). Stockage dans une clé dédiée `abmat:profile`, incluse dans l'export annuel. La table des SMIC reste dans `config.js` (mise à jour par le mainteneur, 1×/an) — l'override manuel ne sert que si l'année manque.
- **Encart « Ma déclaration »** dans le récap annuel : le montant et la case exacte (traitements et salaires, 1AJ), avec la consigne de remplacer le montant prérempli.
- **Comparaison des deux régimes** (salaires seuls vs tout + abattement) : vérifie chaque année que l'option est gagnante. Prudence : structure des indemnités en CCAS à valider sur ses fiches de paie.
- Rappel d'export en fin d'année ; statut « Vide » non alarmant pour un mois de congés.

## Lot 6 — Distribution

- Publier sur **GitHub Pages** (repo existant) ; ajouter manifest + service worker (**PWA**) : raccourci bureau/téléphone, hors-ligne conservé, mises à jour automatiques, données jamais en ligne.

## Différé / décisions en attente

- ~~Garde en deux fois~~ → **tranché le 2026-07-19** : multi-créneaux par enfant/jour (voir lot 3).
- **SMIC : consultable, jamais modifiable** (décision 2026-07-19) : le barème s'affiche en lecture seule dans « Mes informations » ; il est maintenu dans `config.js` (livré automatiquement via GitHub Pages une fois le lot 6 fait). La saisie manuelle n'apparaît que si l'année n'est pas encore dans le barème (début janvier) — un champ modifiable en permanence serait un risque d'erreur fiscale.
- Samedi travaillé, 4ᵉ enfant : hors périmètre tant que le besoin réel n'existe pas.
- Design system Claude Design (claude.ai/design) : optionnel, seulement si on veut itérer visuellement sur les composants ; la maquette artifact suffit pour ce projet.
