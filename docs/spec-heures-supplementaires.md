# Heures supplémentaires — proposition de spécification

Statut : **règle de calcul validée le 29/09/2026** (points 1 à 5 ci-dessous) ; rien n'est codé. Les questions **Q4 à Q7** restent à trancher, idéalement **par écrit avec le CCAS** (règlement de la crèche familiale ou délibération), avant de coder. Maquette : pointeuse + détail jour par jour (artifact « Calendrier Ass-Mat », v2).

## Besoin exprimé

> Calculer les heures supplémentaires à la demi-heure (toute demi-heure entamée est due), pour les heures au-dessus de 10 h dans une journée — de l'arrivée du premier enfant au départ du dernier — en ajoutant parfois des réunions.

## Règle validée

1. **Temps « enfants »** = de la **première arrivée** d'un enfant au **dernier départ** d'un enfant, tous enfants confondus (accueil relais compris). Les enfants absents sont ignorés. Un creux sans enfant entre les deux **est compté** (décision du 29/09/2026 ; ça n'arrive en pratique jamais).
2. **Réunions** (heure de début et de fin) : on ajoute le temps de réunion **en dehors** de la plage « enfants ». Une partie de réunion pendant que des enfants sont là n'est **pas comptée deux fois** ; le temps **entre le départ du dernier enfant et le début de la réunion** (ou entre la fin d'une réunion matinale et la première arrivée) **n'est pas compté**. Autrement dit : temps de la journée = union des plages « enfants » et « réunions ».
3. **Seuil** : au-delà de 10 h 00 par jour (« heures au-dessus de 10 h ») ; exactement 10 h 00 = aucune heure supplémentaire.
4. **Arrondi** : le dépassement est arrondi à la **demi-heure supérieure** (1 min → 0 h 30 ; 30 min → 0 h 30 ; 31 min → 1 h 00).
5. Le calcul se fait **jour par jour** ; semaine et mois additionnent des jours **déjà arrondis**.
6. Un horaire invalide ou incomplet dans la journée → heures supplémentaires **« à vérifier »** pour ce jour, jamais un calcul silencieux (même principe que l'abattement).

## Exemples (futurs tests)

| Journée | Temps retenu | Heures sup. |
|---|---|---|
| Léa 7h30 → 17h30 | 10 h 00 | 0 |
| Léa 7h30 → 17h31 | 10 h 01 | 0 h 30 |
| Léa 7h45 → 18h10 | 10 h 25 | 0 h 30 |
| Léa 7h30 → 18h00 | 10 h 30 | 0 h 30 |
| Léa 7h00 → 17h45 | 10 h 45 | 1 h 00 |
| Léa 7h30 → 12h00, Tom 13h30 → 18h00 | 10 h 30 (creux compté) | 0 h 30 |
| Léa 8h00 → 17h00 + réunion 19h00 → 21h00 | 9 h + 2 h = 11 h 00 | 1 h 00 |
| Léa 8h00 → 18h00 + réunion 17h00 → 19h00 | 8h00 → 19h00 = 11 h 00 (1 h de chevauchement comptée une fois) | 1 h 00 |
| Léa 8h00 → 18h15 + réunion 17h30 → 19h00 | 10 h 15 + 45 min = 11 h 00 | 1 h 00 |
| Réunion 7h00 → 7h30, Léa 8h00 → 17h30 | 30 min + 9 h 30 = 10 h 00 (pause 7h30 → 8h00 non comptée) | 0 |
| Léa absente, Tom 9h00 → 16h00 | 7 h 00 | 0 |
| Léa 8h00 → ⚠ (sortie manquante) | — | à vérifier |

## Explication affichée pour chaque jour (demandé le 29/09/2026)

Chaque jour travaillé affiche **pourquoi** il y a, ou non, des heures supplémentaires, dans la fiche du jour, dans la pointeuse (en direct) et dans le détail du mois. Modèles de phrases :

- « Enfants : de 7h15 (arrivée de Léa) à 18h00 (départ de Tom) = 10 h 45. »
- « Réunion de 19h00 à 21h00 : 2 h ajoutées. La pause de 17h30 à 19h00 n'est pas comptée. »
- « Réunion de 17h30 à 19h00 : 45 min en même temps que les enfants (comptées une seule fois), 45 min ajoutées. »
- « Réunion de 16h00 à 17h00 : pendant que des enfants étaient là, déjà comptée. Rien à ajouter. »
- « Journée retenue : 11 h 30. »
- Verdict : « 9 h 30 : 10 h ou moins, pas d'heure supplémentaire. » ou « 1 h 15 au-delà de 10 h → 1 h 30 d'heures sup. (toute demi-heure commencée compte) ».

## Questions encore ouvertes

- **Q2 bis — Réunion un jour sans enfant** (mercredi libre, samedi) : compte-t-elle seule ? Si oui, il faudra afficher les samedis, aujourd'hui masqués.
- **Q4 — Autres seuils** : existe-t-il aussi un seuil **hebdomadaire** (ex. 45 h) ou un plafond ? Si oui, comment se combine-t-il avec le seuil journalier (sans compter deux fois les mêmes minutes) ?
- **Q5 — Paiement** : quelle majoration, payée ou récupérée ? L'outil doit-il afficher un **montant en euros** (taux horaire à saisir) ou seulement des **heures** (recommandé pour commencer) ?
- **Q6 — Temps hors enfants** : préparation, ménage, transmissions avant l'arrivée ou après le départ des enfants — exclus, comme le dit la définition ?
- **Q7 — Référence écrite** : quel texte du CCAS fonde la règle ? Il sera cité sur le relevé imprimé.

## Ce que ça ne change pas côté impôts

- **L'abattement ne bouge pas** : il dépend du temps de présence de **chaque enfant**, pas du temps de travail ni des heures supplémentaires.
- La rémunération des heures supplémentaires figure sur la fiche de paie. Si elle est **exonérée d'impôt** (dans la limite annuelle de 7 500 €), elle n'est normalement **pas** comprise dans le « net imposable » : il ne faut rien ajouter. À vérifier sur une fiche de paie du CCAS qui en contient.
- L'outil sert donc au **contrôle** : heures supplémentaires comptées par l'outil ↔ heures payées sur la fiche de paie.

## Conception proposée

### Données (schéma v3)

```json
"2026-09-14": {
  "children": { "lea": { "absent": false, "motif": "", "slots": [ { "in": "07:45", "out": "18:10" } ], "punched": true } },
  "meetings": [ { "in": "19:00", "out": "21:00", "label": "Réunion crèche familiale" } ]
}
```

- `meetings` : liste (max 3), vide par défaut. Migration v2 → v3 dans `normalizeData()` (`meetings: []`), `version: 3`.
- Un jour qui n'a **que** des réunions doit compter comme « non vide » pour l'export (`isBlankMonth`).

### Calcul (pur, sans DOM, testé)

Nouveau module `app/lib/overtime.js` → `window.ABMAT.overtime`, chargé après `calc.js` :

- `computeDaySpan(dayObj)` → `{status, startMin, endMin, workedMin}` : union des intervalles `[min(in), max(out)]` des enfants présents et des réunions.
- `computeDayOvertime(dayObj, rules)` → `{status, workedMin, overtimeMin}` avec `overtimeMin = ceil(max(0, workedMin − seuil) / pas) × pas`.
- `computeMonthOvertime(daysMap, rules)` → total + détail par jour.
- Règles dans `config.js`, pour pouvoir les ajuster une fois validées : `overtime: { dailyThresholdMinutes: 600, roundingStepMinutes: 30 }`.

Tests `tests/overtime.test.js` : les 10 exemples ci-dessus + chevauchement de réunions entre elles + migration v2 → v3.

### Interface

- **Fiche du jour** : bloc « Réunion » (+ Ajouter une réunion) et bloc « Heures supplémentaires de la journée » avec l'explication ci-dessus.
- **Pointeuse** : boutons « Début de réunion » / « Fin de réunion » ; explication en direct (« Pour l'instant : … ») et heure à partir de laquelle les heures sup. commencent.
- **Colonne du mois** : un bloc **séparé** du bloc impôts, « Heures supplémentaires : 3 h 30 », « 3 jours au-delà de 10 h », « À comparer avec la fiche de paie », et « Voir le détail jour par jour » (tous les jours, avec ou sans heures sup., chacun avec son explication).
- **Impression** : une section « Heures supplémentaires » en fin de relevé mensuel (jour, arrivée du 1ᵉʳ enfant, départ du dernier, réunions, temps retenu, heures sup.) ou un **document séparé** à remettre au CCAS (**Q** : lequel est utile en pratique ?).
- **Mon année** : total annuel pour information.

### Ordre de réalisation

1. Réponses aux questions Q2 bis et Q4-Q7.
2. Calcul + tests (sans interface).
3. Schéma v3 + migration + tests.
4. Interface de saisie des réunions, badge, bloc résultat.
5. Impression.
