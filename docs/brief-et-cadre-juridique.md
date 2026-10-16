# Via Sana — Brief & cadre de protection des données

## Brief (source : page Notion « Product Builder / Dev »)

**Contexte** — Via Sana organise des parcours de soins coordonnés : plusieurs praticiens suivent un même patient autour d'un objectif. Exemple : « Préparation Marathon » (médecin généraliste, kinésithérapeute, ostéopathe, diététicien). Ces parcours passent aujourd'hui par des outils dispersés (formulaires externes, emails, WhatsApp, fichiers partagés).

**Mission** — Prototype fonctionnel pour suivre un patient dans le parcours « Préparation Marathon ».

**Interface praticien**
- liste des patients, filtres par parcours / statut / étape
- fiche patient : identité, objectif, formulaire préalable, praticiens impliqués, prochaines séances, historique, notes de suivi
- étapes réalisées / en cours / à venir
- ajout d'informations de suivi

**Interface patient (simplifiée)**
- remplir / consulter le formulaire préalable
- visualiser son parcours, ses prochaines séances, les étapes passées et à venir
- informations de suivi simples

**Contraintes** — 3 jours, choix techniques libres, logique structurée (données, flux), application web ou mobile fonctionnelle.
**Livrables** — lien vers le projet (app/repo) + restitution orale.

## Cadre juridique (sources Légifrance, consultées le 16/10/2026)

| Texte | Ce qu'il impose | Traduction dans l'outil |
|---|---|---|
| [CSP art. L1110-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043895798) | Secret couvrant toutes les informations du patient. Échange entre professionnels identifiés seulement s'ils participent tous à la prise en charge et si l'information est **strictement nécessaire** à la coordination. Partage hors équipe de soins = **consentement préalable**. Droit d'**opposition** à tout moment (IV). Accès illégitime : 1 an / 15 000 € (V). | Un praticien ne voit que les patients dont il fait partie de l'équipe de soins (contrôle côté serveur, pas seulement dans l'UI). Formulaire préalable découpé en sections, chacune visible uniquement par les professions qui en ont besoin. Notes « équipe », « privées » ou « visibles patient ». Opposition au partage activable par le patient : chaque praticien ne voit alors plus que ses propres notes. |
| [CSP art. L1110-12](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031919050) | Définition de l'équipe de soins (même structure, reconnue par le patient, ou organisation formalisée). | L'équipe de soins est une donnée explicite (table `care_team`), affichée au patient dans « Confidentialité ». |
| [CSP art. L1111-8](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902) | Hébergement des données de santé chez un hébergeur **certifié HDS**, stockage UE/EEE, information du patient, contrat ; cession de données identifiantes interdite (VII). | Prototype : **données 100 % fictives**. Production : hébergeur certifié HDS en UE, mention d'information patient. |
| [CSP art. R1112-7](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351) | En établissement de santé : dossier médical conservé **20 ans** après le dernier passage (prorogation jusqu'aux 28 ans du titulaire). | Pas de suppression physique du dossier : statut « terminé » + archivage. Politique de conservation à arrêter avec le DPO selon le statut juridique du centre. |
| [Loi 78-17 art. 6](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037822942) | Les données de santé sont interdites de traitement sauf exceptions de l'art. 9.2 RGPD (ex. : prise en charge sanitaire par des professionnels soumis au secret). | Finalité unique : coordination des soins. Aucune donnée réutilisée à d'autres fins (pas d'analytics tiers, pas de trackers). |
| [CNIL SAN-2026-009 du 21/07/2026](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000054790100) | Sanction d'un hôpital : matrice d'habilitation sans **cloisonnement des dossiers patients** (l'éditeur pouvait accéder à tous les dossiers) ; rappel que la **journalisation** (recommandation CNIL 2021-122) doit être exploitée, pas seulement collectée. | Cloisonnement par équipe de soins + journal des accès consultable **par le patient lui-même** (transparence) et par les praticiens. |

Point non vérifié via Légifrance : CSP art. L1111-7 (droit d'accès du patient à ses informations) — la consultation a été interrompue ; à confirmer avant la restitution.

> Limite : ce tableau est une analyse produit, pas un avis juridique. Le statut exact de Via Sana (centre de santé, maison de santé, cabinet) conditionne certaines obligations (durée de conservation, équipe de soins au sens du 1° ou du 3° de L1110-12).
