# Via Sana — Brief, offre PrépaMarathon et cadre de protection des données

## 1. Le brief (page Notion « Product Builder / Dev »)

**Contexte.** Via Sana organise des parcours de soins coordonnés : plusieurs praticiens suivent un même patient autour d'un objectif. Ces parcours passent aujourd'hui par des outils dispersés (formulaires externes, emails, WhatsApp, fichiers partagés).

**Mission.** Construire un prototype fonctionnel pour suivre un patient dans le parcours « Préparation Marathon ». Dans la page Notion, ce nom renvoie vers [prepamarathon.com](https://prepamarathon.com/).

**Interfaces attendues.**
- Praticien : liste et filtres, fiche patient, informations du formulaire préalable, étapes réalisées / en cours / à venir, informations de suivi.
- Patient : formulaire préalable, vue du parcours, prochaines séances, informations de suivi.

**Contraintes.** 3 jours, choix techniques libres. Livrables : un lien vers le projet et une restitution orale.

## 2. Ce que montre prepamarathon.com (consulté le 16/10/2026)

| Élément de l'offre | Conséquence pour l'outil |
|---|---|
| Questionnaire en ligne de 5 minutes, lu par le kiné avant le bilan (aujourd'hui sur un formulaire externe Eval&GO) | Questionnaire intégré, première étape du parcours |
| Téléconsultation médecin proposée avant le bilan, notamment pour obtenir une ordonnance | Étape optionnelle, retirée automatiquement si le patient a déjà une ordonnance |
| Bilan de course de 30 min avec un kiné du sport, sur 6 dimensions | Compte rendu structuré selon ces 6 dimensions |
| Plan d'action remis en PDF : observations et recommandations | Compte rendu publié, imprimable en PDF |
| Le patient peut s'arrêter au bilan ; sinon parcours coordonné de 6 mois à 150 €, hors honoraires, sans reconduction | Deux offres, et une étape « Choix de la suite » |
| Analyse de foulée sur tapis (optionnelle) | Étape optionnelle du parcours coordonné |
| Équipe composée selon les besoins identifiés au bilan, parmi 8 professions | Catalogue d'étapes et réseau de praticiens ; équipe proposée par la coordination, validée par le patient |
| Un coordinateur qui « organise, relance et suit » | Rôle et espace dédiés à la coordination |
| « Dossier unique », protocole commun de bilans et de comptes rendus | Comptes rendus partagés dans l'équipe |
| Le bilan peut être partagé avec les praticiens qui suivent déjà le patient | Partage externe sur consentement, révocable |
| « VIA SANA n'est pas un établissement de santé et ne dispense aucun soin » | La coordination n'a pas accès au contenu clinique (voir § 3) |

## 3. Cadre juridique (sources Légifrance, consultées le 16/10/2026)

| Texte | Ce qu'il impose | Traduction dans l'outil |
|---|---|---|
| [CSP art. L1110-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043895798) | Secret couvrant toutes les informations du patient. Entre professionnels de l'équipe de soins, partage limité au **strictement nécessaire** (II, III). Partage hors équipe de soins = **consentement préalable** (III). Droit d'**opposition** à tout moment (IV). Accès illégitime puni d'un an d'emprisonnement et 15 000 € d'amende (V). | Accès refusé, et tracé, à tout praticien que le patient n'a pas accepté. Questionnaire découpé par profession. Notes privées. Opposition activable par le patient. Partage externe soumis à une case de consentement explicite, révocable. |
| [CSP art. L1110-12](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031919050) | Équipe de soins. Le 2° vise les professionnels dont le patient a « reconnu la qualité de membre de l'équipe de soins ». | Un praticien proposé par la coordination n'accède au dossier **qu'après acceptation par le patient** (statut `proposee` puis `acceptee` dans la table `care_team`). |
| Statut de Via Sana | Via Sana se présente comme service de coordination, pas comme établissement de santé. La coordinatrice n'est pas une professionnelle de santé. | La coordination voit l'organisation (étapes, rendez-vous, équipe, section « Organisation » du questionnaire), jamais les réponses de santé, les notes ni les comptes rendus. Le refus est appliqué côté serveur et tracé. |
| [CSP art. L1111-8](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902) | Hébergement des données de santé chez un hébergeur **certifié HDS**, stockage UE/EEE, information du patient, contrat ; cession de données identifiantes interdite (VII). | Le prototype n'utilise que des données fictives. En production : hébergeur HDS, ce que le questionnaire actuel annonce déjà. |
| [Loi 78-17 art. 6](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037822942) | Données de santé interdites de traitement, sauf exceptions de l'art. 9.2 du RGPD. | Une seule finalité : la coordination du parcours. Aucune donnée réutilisée à d'autres fins ; aucun traceur. |
| [CNIL SAN-2026-009 du 21/07/2026](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000054790100) | Sanction d'un hôpital : matrice d'habilitation sans **cloisonnement des dossiers patients** (le personnel de l'éditeur accédait à tous les dossiers) ; rappel que la **journalisation** doit être exploitée, pas seulement collectée. | Habilitations par rôle et par dossier. Journal des accès, refus compris, consultable par le patient lui-même. |

**Retiré par rapport à la première version.** L'article [R1112-7](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351), qui fixe une conservation de 20 ans, vise les établissements de santé. Il ne s'applique pas à Via Sana en tant que coordinateur. En revanche, les praticiens restent tenus de conserver leurs propres dossiers. La durée de conservation des données de coordination est à fixer avec le DPO.

**Point non vérifié via Légifrance.** L'article L1111-7 du CSP (droit d'accès du patient à ses informations) : la consultation a été interrompue. À confirmer.

## 4. Points d'attention pour Via Sana (à aborder avec tact)

- La [politique de confidentialité](https://prepamarathon.com/politique-de-confidentialite.html) du site ne couvre que les emails de la liste d'attente. Le questionnaire, lui, collecte des données de santé et annonce un hébergement HDS. Il manque donc une information patient dédiée à ces données : finalité, base légale, destinataires, durée de conservation, droits.
- Le questionnaire vit sur un outil tiers (Eval&GO). Il faut vérifier sa certification HDS et le contrat de sous-traitance, ou internaliser le questionnaire, comme le fait le prototype.

> Limite : ce document est une analyse produit, pas un avis juridique.
