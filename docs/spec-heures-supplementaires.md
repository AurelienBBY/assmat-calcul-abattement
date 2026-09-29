# Heures supplémentaires — proposition de spécification

Statut : **brouillon à valider** (29/09/2026). Rien n'est codé. Les règles ci-dessous traduisent le besoin exprimé ; les points marqués **Q** doivent être tranchés, idéalement **par écrit avec le CCAS** (règlement de la crèche familiale ou délibération), avant tout développement.

## Besoin exprimé

> Calculer les heures supplémentaires à la demi-heure (toute demi-heure entamée est due), pour les heures au-dessus de 10 h dans une journée — de l'arrivée du premier enfant au départ du dernier — en ajoutant parfois des réunions.

## Règle proposée (v0)

1. **Temps de la journée** = de la **première arrivée** d'un enfant au **dernier départ** d'un enfant, tous enfants confondus. Les enfants absents sont ignorés. Un creux sans enfant au milieu de la journée **est compté** (c'est une amplitude). → **Q1**
2. **Réunions** : saisies avec une heure de début et une heure de fin. Le temps de la journée devient l'**union des plages horaires** « enfants » et « réunions » : une réunion le soir après le départ du dernier enfant s'ajoute ; une réunion qui chevauche la présence des enfants n'est pas comptée deux fois. → **Q2**
3. **Seuil** : 10 h 00 par jour. Exactement 10 h 00 = aucune heure supplémentaire. → **Q3**
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
| Léa 8h00 → 18h00 + réunion 17h00 → 19h00 | 8h00 → 19h00 = 11 h 00 | 1 h 00 |
| Léa absente, Tom 9h00 → 16h00 | 7 h 00 | 0 |
| Léa 8h00 → ⚠ (sortie manquante) | — | à vérifier |

## Questions à trancher

- **Q1 — Creux sans enfant** : une pause sans aucun enfant (entre deux accueils) compte-t-elle dans le temps de travail ?
- **Q2 — Réunions** : se cumulent-elles comme proposé (union des plages) ou s'ajoutent-elles simplement en durée ? Une réunion **un jour sans enfant** (mercredi libre, samedi) compte-t-elle seule ? Si oui, il faudra afficher les samedis, aujourd'hui masqués.
- **Q3 — Seuil** : 10 h pile = 0, confirmé ?
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
  "children": { "1": { "absent": false, "motif": "", "slots": [ { "in": "07:45", "out": "18:10" } ] } },
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

- **Carte du jour** : bouton « + réunion » à côté de « + enfant » ; ligne réunion `[19:00 → 21:00] [libellé facultatif]`. Un badge **n'apparaît que s'il y a dépassement** : « 10 h 45 de travail · 1 h 00 sup. ». Rien sinon, pour garder l'écran calme.
- **Colonne résultat** : un bloc **séparé** du bloc impôts, « Heures supplémentaires : 3 h 30 ce mois-ci (4 jours) », avec la phrase « À comparer avec votre fiche de paie ».
- **Impression** : une section « Heures supplémentaires » en fin de relevé mensuel (jour, arrivée du 1ᵉʳ enfant, départ du dernier, réunions, temps retenu, heures sup.) ou un **document séparé** à remettre au CCAS (**Q** : lequel est utile en pratique ?).
- **Mon année** : total annuel pour information.

### Ordre de réalisation

1. Réponses aux questions Q1-Q7.
2. Calcul + tests (sans interface).
3. Schéma v3 + migration + tests.
4. Interface de saisie des réunions, badge, bloc résultat.
5. Impression.
