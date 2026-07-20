# Handoff : Redesign "Liquid Glass" — Abattement Ass-Mat

## Pourquoi ce dossier
Je n'ai pas d'accès en écriture à votre dossier local (`Assmat - Calcul abattement/`) — seulement en lecture, pour étudier votre code réel. Ce dossier contient donc **tout ce qu'il faut pour appliquer vous-même (ou via Claude Code) le redesign** sur votre vrai projet : les fichiers de référence HTML/CSS créés dans cette conversation, et ce README qui documente précisément quoi changer, où, et pourquoi.

## Nature des fichiers
Les fichiers dans `references/` sont des **maquettes HTML autonomes** (design system), pas du code à copier-coller tel quel. Votre app réelle est du HTML/CSS/JS vanilla sans bundler — donc contrairement à un handoff vers React, ici la recréation est **directe** : les CSS peuvent être adaptées quasi telles-quelles dans vos fichiers `app/styles/*.css`, en gardant tous vos sélecteurs, IDs et attributs `data-*` existants (le JS ne doit jamais être touché sur ces points).

## Fidélité
**Haute fidélité** — couleurs, espacements, typographie et comportements sont définis précisément ci-dessous à partir des maquettes validées dans la conversation.

## Ce qui change (résumé produit)
1. **Style visuel** : passage à un "liquid glass" propre (verre translucide, flou, reflets discrets, teinte au choix parmi Encre/Sauge/Prune — nous avons validé **Prune**), au lieu du bleu encre plat actuel.
2. **Toolbar + navigation** : la barre d'actions et la barre de mois se fondent visuellement en un seul groupe glass qui ne se soude qu'au moment du scroll (sticky).
3. **Boutons Sauvegarder + Importer → un seul bouton "Données"** (icône disquette) qui ouvre un petit menu (Sauvegarder l'année / Importer une sauvegarde), avec une pastille verte quand tout est enregistré. Remplace les 2 boutons + la pilule "✓ Enregistré" séparée.
4. **"Mes infos" quitte la barre des mois** (ce n'est pas une période temporelle) pour devenir une icône ⚙ dans la toolbar, à côté du bouton Données.
5. **Barre des mois scrollable** avec dégradés de bord (apparaissent/disparaissent selon la position de scroll) pour signaler qu'elle se fait glisser quand tout ne tient pas à l'écran.
6. **Icônes** : émojis (💾📂🖨✓) remplacés par des icônes trait fin (SVG inline, style "SF Symbols").
7. **Tableau des jours** : rendu en rangées glass par jour (au lieu du tableau HTML brut) — mais **la structure de données et les attributs `data-*` utilisés par `day-rows.js`/`month-table.js` ne changent pas**, seul l'habillage visuel change (voir détail plus bas).
8. **Bannière de restauration**, **modale tutoriel**, **onglet Mes infos**, **récapitulatif annuel** : même traitement glass, cohérent avec le reste.
9. **PDF / impression : volontairement inchangé**, reste sobre/papier (décision produit prise en conversation — le liquid glass ne s'applique qu'à l'écran, jamais à l'impression). Ne touchez pas à `90-print.css` ni aux gabarits `print-*.js`.

## Design tokens
```css
--hue: 322;              /* Prune (Encre=258, Sauge=156, Prune=322) */
--l-accent: 42%; --c-accent: .1;
--l-dark: 26%;   --c-dark: .095;
--blur: 24px;             /* intensité "médium" retenue */
--glass-top: .68; --glass-bot: .5; --glass-border: .65;
--glass-shadow: 0 10px 30px rgba(20,30,60,.12), 0 1px 0 rgba(255,255,255,.6) inset;
--radius-lg: 24px; --radius-md: 16px; --radius-sm: 12px;
```
Fond général : 3 radial-gradients doux (oklch, teinte accordée au hue) sur fond oklch(98% .006 hue), `background-attachment: fixed`. Voir `references/styles.css` pour les classes utilitaires `.glass`, `.glass-strong`, `.btn`, `.btn-primary`, `.pill`.

**Cible tactile minimale : 44×44px** sur tous les boutons (norme Apple HIG) — actuellement 36-40px dans `15-toolbar.css`.

## Points d'attention JS (ne pas casser)
- Le bouton combiné "Données" doit continuer à déclencher les mêmes handlers que `data-toolbar-action="export"` et `data-toolbar-action="import"` (`toolbar-actions.js`) — c'est un changement de **présentation** (1 bouton + menu au lieu de 2 boutons), pas de logique.
- Déplacer "Mes infos" hors de `period.js` (qui l'ajoute actuellement dans `.month-tabs`) vers un bouton dans le header nécessite d'ajouter un bouton dans `index.html` (ex. `id="abmat-action-infos"`) et un cas dans `toolbar-actions.js` qui appelle `onPeriodChange({monthIndex:13})` — actuellement câblé uniquement via `infosBtn` dans `period.js`.
- Le tableau des jours : si vous adoptez le rendu "rangées glass" des maquettes, il faut réécrire `day-rows.js`/`month-table.js` pour générer des `<div>` au lieu de `<tr>/<td>` — **plus risqué**. Alternative plus sûre : garder la structure `<table>` réelle et **habiller en CSS uniquement** (rangées arrondies via `display:contents`/`border-collapse:separate` + `border-radius` par ligne, pilules pour les horaires) — recommandé pour un premier lot.
- `90-print.css` et tous les `render/print-*.js` : **ne pas toucher**.

## Fichiers de référence inclus
- `references/apercu-ecran-principal.html` — écran principal complet (toolbar+nav, saisie du mois, résultat, tableau des jours)
- `references/apercu-recap-annuel.html` — onglet RÉCAP
- `references/infos-onglet-mes-infos.html` — onglet Mes infos
- `references/etats-restauration.html` — bannière de restauration
- `references/etats-modale-tutoriel.html` — modale tutoriel
- `references/saisie-pre-remplissage.html` — bandeau de pré-remplissage
- `references/saisie-parametres-smic.html` — bloc paramètres SMIC
- `references/documents-releve-imprime.html` — relevé PDF (sobre, référence de non-régression)
- `references/documents-recap-annuel-imprime.html` — récap annuel PDF (sobre)
- `references/styles.css` — tokens + classes utilitaires glass

## Vérification (reprendre votre check-list existante)
Après implémentation dans le vrai projet, suivez votre procédure `CLAUDE.md` : ouvrir la page, saisir des heures sur un mois (cas ≥8h et <8h), renseigner net+IRF, vérifier le résultat mensuel, ouvrir RÉCAP, tester l'aperçu d'impression (Cmd+P) — et en plus, vérifier que le bouton "Données" déclenche bien export ET import, et que l'icône ⚙ ouvre bien MES INFOS.
