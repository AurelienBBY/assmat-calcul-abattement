# Architecture des écrans (lot 12)

Pas de modules ES : l'ordre des `<script>` dans `index.html` fait office de système de modules. Chaque couche ne dépend que des couches au-dessus d'elle ; seules `render/` et `ctrl/` touchent le DOM, et seul `ctrl/` lit ou écrit le stockage à la demande d'un geste.

```mermaid
flowchart TD
  CFG["config.js<br/>SMIC, coefficient, 4 enfants, seuil 10 h"]
  UTIL["lib/utils.js<br/>dates, fériés, HH:MM, montants"]
  CALC["lib/calc.js<br/>abattement, simultanéité"]
  OT["lib/overtime.js<br/>heures sup. + explications"]
  STO["lib/storage/*<br/>mois v3, profil v2, réglages d'année,<br/>années déclarées, fusion, état de copie"]
  AUTO["lib/autosave.js<br/>dossier de copie (ordinateur)"]
  CMP["lib/compute/*<br/>enfants, récap, relevé, pré-remplissage,<br/>calendrier, pointeuse, rappels de copie"]
  RND["lib/render/*<br/>DOM seulement (R.h, jamais innerHTML de données)"]
  CTX["ctrl/ctx.js<br/>état, lecture/écriture, Annuler, A.render"]
  SCR["ctrl/today · month + day · year · profile + profile-edit"]
  BK["ctrl/backup + backup-folder<br/>copie de secours, rappels"]
  PR["ctrl/print.js<br/>#print-doc"]
  APP["app.js<br/>onglets, aide, onglet de départ, service worker"]

  CFG --> UTIL --> CALC --> OT --> STO --> AUTO --> CMP --> RND --> CTX
  CTX --> BK --> PR --> SCR --> APP
```

## Cycle d'un geste

```mermaid
sequenceDiagram
  participant U as Utilisatrice
  participant R as render/*
  participant C as ctrl/*
  participant S as storage
  participant K as compute / calc / overtime
  U->>R: clic (ex. « Arrivée »)
  R->>C: handler(id)
  C->>S: A.loadMonth (relit le stockage)
  C->>K: Compute.punchIn(données, jour, id, heure)
  C->>S: A.saveMonth (updatedAt si le contenu change)
  C->>C: A.backup.changed(jours modifiés)
  C->>R: A.render() puis message « … notée » + Annuler
```
