# Schéma des données — v3 (lot 12)

Tout est stocké dans le navigateur (localStorage) et voyage dans le fichier de sauvegarde d'année `abattement-assmat-AAAA.json`. Les photos des fiches de présence, trop lourdes pour localStorage, sont dans IndexedDB et voyagent dans un second fichier, `abattement-assmat-AAAA-fiches.json`.

```mermaid
classDiagram
  direction LR
  class Profil {
    clé abmat:profile
    version = 2
    firstName
    lastName
    employer
    children : Enfant[]
    updatedAt
  }
  class Enfant {
    id : "c1", "c2"…
    name
    from : date ou null
    to : date ou null
    periods : Periode[]
  }
  class Periode {
    from : date ou null
    week : lundi 1 … vendredi 5 → in, out
  }
  class ReglagesAnnee {
    clé abmat:settings:AAAA
    version = 1
    year
    smic : nombre ou null
    relais : booléen
    updatedAt
  }
  class Mois {
    clé abmat:AAAA-MM
    version = 3
    year
    monthIndex
    netImposable
    irf
    verified
    done
    days : date → Jour
    updatedAt
  }
  class Jour {
    off : non travaillé
    children : id → Presence
    meetings : Creneau[] (3 max)
  }
  class Presence {
    absent
    motif
    slots : Creneau[] (3 max)
    punched : pointé
    relais : si id "r1"…
    name : prénom si relais
  }
  class SauvegardeAnnee {
    format = "abmat-year"
    version = 2
    year
    months : index → Mois
    profile : Profil
    settings : ReglagesAnnee
  }
  Profil "1" --> "*" Enfant
  Enfant "1" --> "1..*" Periode
  Mois "1" --> "*" Jour
  Jour "1" --> "*" Presence
  SauvegardeAnnee --> Mois
  SauvegardeAnnee --> Profil
  SauvegardeAnnee --> ReglagesAnnee
  class PhotoFiche {
    IndexedDB abmat-fiches, magasin photos
    key : "AAAA-MM:recto" ou "AAAA-MM:verso"
    year
    bytes : JPEG ≤ 1800 px (ArrayBuffer), ou null (supprimée)
    updatedAt
  }
  class SauvegardeFiches {
    format = "abmat-fiches"
    version = 1
    year
    photos : clé → updatedAt, data (image en base64) ou null
  }
  SauvegardeFiches --> PhotoFiche
```

## Règles

- **Enfants** : identifiés par un id stable (`c1`, `c2`…), jamais réutilisé. Autant d'enfants que nécessaire ; `from` / `to` bornent la période d'accueil (null = pas de borne). Un jour ne contient que les enfants qui ont une donnée (présence, absence).
- **Horaires habituels versionnés** : `periods` triées par `from` ; la période en vigueur à une date est la dernière dont `from` ≤ date (`from: null` = depuis toujours). Un changement d'horaires ajoute une période ; il ne modifie jamais un jour pointé, modifié à la main, ni un mois terminé (`Compute.rescheduleMonth`).
- **Accueil relais** : présences d'id `r1`, `r2`… avec `relais: true` et `name` (prénom saisi ce jour-là). Elles comptent dans l'abattement comme les autres. Activé par année (`ReglagesAnnee.relais`).
- **4 enfants au plus en même temps** : contrôlé par `C.maxSimultaneous(jour)`, pas par le nombre d'enfants dans la journée.
- **SMIC** : un seul par année. `ReglagesAnnee.smic` s'il est réglé, sinon le barème de `config.js`, sinon « SMIC manquant » (aucun abattement calculé en silence).
- **Mois** : `verified` (jours vérifiés) et `done` (mois terminé) portent l'état du mois ; `off` marque un jour non travaillé ; `meetings` sert aux heures supplémentaires.
- **Jour pointé** (au moins une présence `punched`) : heures réelles, jamais modifiées par une action de masse (semaine de congés, journée habituelle) ni par un changement d'horaires.
- **Photos de la fiche de présence** : une par face (recto = 1er au 15, verso = 16 à la fin du mois), dans IndexedDB (`S.fiches`, `storage/fiches.js`). Les octets de l'image sont rangés (ArrayBuffer + `type`), jamais un Blob : Safari sur iPhone enregistre mal les Blob dans IndexedDB. Une photo supprimée devient une pierre tombale (`bytes: null` + `updatedAt`) pour que la suppression gagne aussi à la fusion. Fusion du fichier `abmat-fiches` : la photo la plus récente gagne, clé par clé (`Compute.fichesMergePlan`). Le fichier n'est réécrit (ordinateur) ou envoyé (iPhone, clé `AAAA-MM-fiche` dans `pending`) que si une photo a changé.
- **Hors sauvegarde, propre à l'appareil** : `abmat:declaredYears` (repère « déclarée »), `abmat:sync` (copie manuelle sur iPhone : `lastSentAt`, `lastImportAt`, `pending` = jours/mois modifiés depuis le dernier envoi, `lastPromptOn`, `sendSnoozeUntil`, `importSnoozeUntil`), `abmat:ui:onboarding` (`{ step, done }` : étape atteinte de la mise en route), `abmat:ui:tips` (bulles d'aide déjà lues) et `abmat:ui:install` (`{ skipped }` : « Continuer sans installer »). Effacer une année (`S.eraseYear` + `S.fiches.eraseYear`) retire ses mois, ses réglages, ses photos et son repère « déclarée ». « Tout effacer sur cet appareil » (`AS.forget` + `S.fiches.eraseAll` + `S.eraseAll`) supprime les bases `abmat-autosave` et `abmat-fiches` et toutes les clés `abmat:` ; les fichiers de copie de secours restent intacts.

## Migrations (automatiques, à la lecture)

- **Mois v1 → v2 → v3** : les enfants `"1"`, `"2"`, `"3"` deviennent `c1`, `c2`, `c3` ; les entrées vides disparaissent ; `smicOverride` (mensuel) est abandonné — le SMIC est désormais réglé par année, et le barème couvre toutes les années saisies avant le lot 12.
- **Profil v1 → v2** : l'ancien `name` (« Nom et prénom ») passe dans `lastName` (à corriger dans le profil si besoin) ; `mention` (n° d'agrément) est retiré ; chaque enfant non vide devient `c1…c3` avec une période d'horaires `from: null` ; un enfant désactivé reçoit `to` = date de la migration. La migration est enregistrée une fois, sans changer `updatedAt`.
- **Sauvegarde d'année v1 → v2** : ajout de `settings` ; les anciens fichiers restent importables (fusion).
