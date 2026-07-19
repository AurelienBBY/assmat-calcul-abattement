# Feuille de route — Assmat Calcul abattement

Mise à jour : 2026-07-19. Ce document fixe **où on va et pourquoi**. Le « comment coder » vit dans `CLAUDE.md` ; ici on ne liste que les objectifs et les décisions produit.

## Cap produit

Outil pour **une utilisatrice unique** : assistante maternelle employée par un CCAS (donc **hors Pajemploi** — aucun récapitulatif fiscal fourni, le calcul de l'abattement depuis les temps de présence réels est entièrement à sa charge). Critères directeurs, dans l'ordre :

1. **Fiabilité du calcul** — c'est un chiffre reporté sur une déclaration fiscale.
2. **Saisie minimale** — utilisatrice non technicienne, geste mensuel qui doit rester court.
3. **Hors-ligne, zéro dépendance, données locales** — décision ferme (voir CLAUDE.md).
4. **Documents imprimables crédibles** — le PDF annuel est le vrai livrable de l'outil.

Cible de distribution : **GitHub Pages + PWA** (lot 6) — elle a un raccourci, toujours la dernière version, données toujours dans son navigateur.

## Lot 1 — Fiabilité (P0, avant tout le reste)

- Réécrire `app/lib/compute/year-recap.js` : abattement réel via `S.loadMonth` + `C.computeMonthTotal` (forfait de l'année + `smicOverride` du mois), compteurs J<8h/J≥8h depuis l'objet `days`, statuts corrects.
- Corriger `config.js` : SMIC 2023 = 11,27 (pas 11,52).
- Commiter le `90-print.css` en attente ; sortir le dossier « Assmat - Calcul abattement copy » du dépôt.
- Nettoyage : supprimer `render/year-abattement.js` (code mort), corriger le sentinel `#toolbar-sentinel`/`#period-sentinel`, retirer le test `window.U` de `render/index.js`, typo « pour en année » dans `rules.js`.

## Lot 2 — Moteur unifié

**Pourquoi** : deux chemins de calcul (mensuel = DOM, annuel = localStorage) ont déjà divergé une fois. Une seule source de vérité rend la divergence impossible.

- `state.data` → `calc.js` → rendu : le DOM n'est plus jamais lu pour calculer.
- Premiers tests (`tests/`) sur `calc.js` (bornes 8h, prorata, invalide) et `storage.js` (imports malformés).
- Export/import **annuel** (12 mois + paramètres dans un JSON) — c'est aussi la vraie sauvegarde.
- Corriger le bouton Sauvegarder en mode RÉCAP (exporte actuellement un fichier `null`).

## Lot 3 — Interface (après maquette validée)

**Pourquoi** : la page met la pédagogie avant la tâche, le tableau affiche 3 lignes/jour même pour 1 enfant, et l'autosave est invisible (angoisse pour une non-technicienne).

- Réorganiser autour du geste mensuel : choisir le mois → saisir → vérifier. Tuto et explication repliés après la première visite.
- Tableau : **1 ligne par jour** + bouton « + enfant » ; **prénoms des enfants** à la place d'« Enfant 1/2/3 » ; jours fériés marqués ; « recopier la semaine précédente ».
- Une **couleur d'accent** unique ; le montant à déclarer en héros visuel ; typo base 16-17 px ; contrastes AA.
- Signal « ✓ Enregistré » visible ; total du mois affiché dans la toolbar sticky.
- Borne d'années fixe (2023 → année courante) au lieu de ±3 ans glissants.

**Méthode** : maquette HTML d'abord (artifact), validée par l'utilisatrice finale avant de toucher au code.

## Lot 4 — PDF

**Pourquoi** : l'impression actuelle aplatit l'écran (champs de formulaire, pas d'identité). Un justificatif doit ressembler à un document.

- **Gabarit d'impression dédié** : section print-only générée en JS ; l'app est masquée à l'impression. Pas de lib PDF (cohérent zéro dépendance).
- **Deux documents** : fiche mensuelle (archive) et récap annuel (le document déclaration), avec en-tête identité (nom, CCAS, période, enfants), encadré des règles appliquées, totaux, date d'édition, mention « aide au calcul, sans valeur justificative ».

## Lot 5 — Parcours utilisateur

- **« Mes informations »** (saisie unique) : son nom, le CCAS, prénoms des enfants — personnalise saisie et PDF.
- **Encart « Ma déclaration »** dans le récap annuel : le montant et la case exacte (traitements et salaires, 1AJ), avec la consigne de remplacer le montant prérempli.
- **Comparaison des deux régimes** (salaires seuls vs tout + abattement) : vérifie chaque année que l'option est gagnante. Prudence : structure des indemnités en CCAS à valider sur ses fiches de paie.
- Rappel d'export en fin d'année ; statut « Vide » non alarmant pour un mois de congés.

## Lot 6 — Distribution

- Publier sur **GitHub Pages** (repo existant) ; ajouter manifest + service worker (**PWA**) : raccourci bureau/téléphone, hors-ligne conservé, mises à jour automatiques, données jamais en ligne.

## Différé / décisions en attente

- **Garde en deux fois** (2ᵉ plage ou champ « heures totales ») : à trancher selon les horaires réels de l'utilisatrice (journées continues en crèche familiale ?). Risque actuel : une plage unique englobante surévalue l'abattement.
- Samedi travaillé, 4ᵉ enfant : hors périmètre tant que le besoin réel n'existe pas.
- Design system Claude Design (claude.ai/design) : optionnel, seulement si on veut itérer visuellement sur les composants ; la maquette artifact suffit pour ce projet.
