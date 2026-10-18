# Via Sana — outil de coordination du parcours PrépaMarathon

Prototype fonctionnel pour suivre un coureur dans le parcours **PrépaMarathon** ([prepamarathon.com](https://prepamarathon.com/)) :
1. un questionnaire en ligne ;
2. un bilan de course avec un kiné du sport ;
3. la remise d'un plan d'action ;
4. au choix du patient, un parcours coordonné de 6 mois avec une équipe pluridisciplinaire.

**Démo en ligne : https://via-sana-outil.vercel.app**

> Toutes les personnes et données sont **fictives**. Le prototype n'est pas un dispositif médical.

## Lancer le projet

Prérequis : **Node.js 24**.

**Base de données** (PostgreSQL) :
- **Par défaut**, aucune installation : une base PostgreSQL embarquée (PGlite) est créée dans `data/pglite`.
- **Avec Supabase** :
  1. Créer un projet en **région UE** (Paris).
  2. Copier `.env.example` en `.env.local`.
  3. Y renseigner `DATABASE_URL` : la chaîne « Transaction pooler », port 6543.
  4. Au premier lancement, le schéma et les données fictives sont créés, avec Row Level Security activée et l'accès par l'API publique fermé.
- ⚠ **Supabase n'est pas un hébergeur certifié HDS** : données fictives uniquement (voir `docs/`, section 4).

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 : la page d'accueil propose deux entrées.
- « Commencer mon bilan » : inscription d'un nouveau client, qui arrive ensuite sur son questionnaire.
- « Se connecter » : `/connexion` propose trois espaces, chacun avec sa page de connexion (email et mot de passe) :
  - `/connexion/patient` pour les coureurs ;
  - `/connexion/praticien` pour les praticiens partenaires ;
  - `/connexion/coordination` pour l'équipe Via Sana.

  Chaque page n'accepte que les comptes de son espace : un compte d'un autre espace reçoit le même message d'erreur qu'un mot de passe faux, sans révéler qu'il existe. Chaque page liste ses comptes fictifs (un clic remplit le formulaire), avec le mot de passe de démonstration commun `Demo-ViaSana-2026`.

  **Double authentification** : après le mot de passe, un code à 6 chiffres est envoyé à l'adresse du compte (page `/connexion/verification`). Il est valable 10 minutes, utilisable une fois, refusé après 5 erreurs, et il peut être renvoyé 3 fois. La session ne s'ouvre qu'après le code. Les adresses étant fictives, une « boîte mail de démonstration » affiche le message envoyé (table `demo_outbox`, vidée dès le code utilisé) ; en production, un service d'email ou de SMS le remplacerait.

Les données fictives sont créées automatiquement au premier lancement. Le bouton « Réinitialiser les données de démo » (page `/connexion`) remet tout à zéro.

## Trois rôles

**Coordination Via Sana** (`/coordination`)
- Une file **« À traiter »** en tête du tableau de bord, calculée à partir des données logistiques et triée par urgence : questionnaire non envoyé (J+x), séance à planifier, plan d'action à remettre, choix de la suite en attente, équipe en attente de validation, fin de coordination proche. Chaque ligne ouvre le dossier sur la bonne section (relances, parcours).
- Tous les parcours, avec filtres appliqués dès le choix, et l'agenda du réseau groupé par jour (Aujourd'hui, Demain…).
- En tête de chaque dossier : « À faire pour ce parcours », téléphone et email cliquables, menu de sections.
- Sur chaque parcours :
  - proposer un praticien du réseau ;
  - ajouter une étape du catalogue selon les besoins du bilan ;
  - planifier une séance avec un membre de l'équipe ;
  - retirer une étape optionnelle ;
  - enregistrer une relance (email, SMS, téléphone) ;
  - changer le statut du parcours.
- **Ne voit jamais le contenu clinique** : ni les réponses de santé, ni les notes, ni les comptes rendus. Via Sana n'est pas un établissement de santé.

**Praticiens partenaires** (`/praticien`)
- Uniquement les patients qui les ont acceptés dans leur équipe.
- Une file **« À traiter »** : douleur déclarée ≥ 5/10, compte rendu à remettre, étape de leur profession en cours. Ces signaux cliniques ne sont jamais montrés à la coordination.
- Filtres par offre, statut et étape ; vue « À surveiller » ; agenda groupé par jour.
- En tête de la fiche patient, un bandeau **« À retenir »** : points d'attention du questionnaire (limités aux sections de leur profession), dernier suivi déclaré, prochaine séance, état du compte rendu. Un menu de sections reste visible pendant le défilement.
- La fiche patient regroupe :
  - les étapes ;
  - le **compte rendu du bilan de course**, structuré sur les 6 dimensions du site, avec un plan d'action publié en PDF ;
  - les notes (équipe, privée, visible par le patient) ;
  - le suivi hebdomadaire ;
  - les sections du questionnaire utiles à leur profession ;
  - les séances et le journal des accès.

**Patient** (`/patient`)
- Tableau de bord : objectif et J-x, prochain rendez-vous, étape en cours, lien pour écrire à la coordinatrice, plan d'action en PDF.
- Un bloc **« À faire »** regroupe ce qui attend le coureur : questionnaire, choix de la suite, praticien à valider, suivi de la semaine.
- Choix « m'arrêter au bilan » ou « continuer en parcours coordonné (150 €, 6 mois) ».
- Validation des praticiens proposés par la coordination.
- Séances : bouton « Ajouter à mon agenda » (fichier `.ics`, uniquement la logistique : titre, praticien, lieu, heure).
- Questionnaire (brouillon puis envoi) et suivi hebdomadaire : douleur et fatigue sur une échelle de 0 à 10 cliquable, confirmation après envoi.
- Les phases terminées du parcours sont repliées ; l'espace est pensé d'abord pour le téléphone.
- « Mes données » : qui voit quoi, opposition au partage, **partage du bilan avec son médecin traitant ou son kiné habituel** (consentement explicite, lien révocable, ouvertures tracées), journal des accès.

## Protection des données : du texte de loi au code

L'analyse complète, avec les liens Légifrance, est dans [`docs/brief-et-cadre-juridique.md`](docs/brief-et-cadre-juridique.md).

| Exigence | Source | Implémentation |
|---|---|---|
| Accès réservé à l'équipe de soins reconnue par le patient | CSP L1110-4, L1110-12 2° | Un praticien est **proposé** par la coordination et n'accède au dossier qu'**après acceptation** par le patient. Vérification à chaque lecture et action serveur (`src/lib/queries.ts`, `src/app/actions.ts`). |
| La coordination n'est pas un professionnel de santé | Statut de Via Sana | Vue logistique dédiée (`getLogisticsFile`) qui ne sélectionne aucun champ clinique. Tentative de lecture d'un compte rendu refusée et tracée. |
| Strictement nécessaire | CSP L1110-4 II-III | Chaque section du questionnaire déclare ses destinataires parmi les 8 professions et la coordination (`src/lib/domain.ts`). |
| Opposition au partage | CSP L1110-4 IV | Chaque praticien ne voit plus que ses propres notes et comptes rendus. |
| Partage hors équipe | CSP L1110-4 III | Case de consentement obligatoire, lien à jeton révocable, chaque ouverture inscrite au journal du patient. |
| Mots de passe | CNIL délibération 2022-100 | Hachage scrypt avec un sel aléatoire de 128 bits par compte (jamais en clair) ; au moins 14 caractères (ou 12 avec un caractère spécial) mêlant majuscules, minuscules et chiffres ; message d'erreur unique ; compte suspendu 15 min après 5 échecs ; journal `auth_logs` sans mot de passe ni identifiant inconnu. **Double authentification** : code à usage unique de 6 chiffres (10 min, 5 essais), dont seul un HMAC est stocké. |
| Cloisonnement et journalisation exploitée | CNIL SAN-2026-009 | Table `access_logs` (accès autorisés et refusés, praticiens, coordination, destinataires externes), visible par le patient. |
| Pas de mise en cache de données de santé | RGPD art. 32 | Rendu 100 % dynamique, `Cache-Control: no-store`, `noindex`, `X-Frame-Options: DENY`. |

## Architecture

```
src/
  app/
    actions.ts                         Server Actions, avec contrôle d'accès par rôle
    page.tsx                           Page d'accueil (commencer son bilan ou se connecter)
    connexion/, commencer/             Choix de l'espace, connexion par espace ([espace]), inscription
    coordination/                      File « À traiter », liste des parcours, vue logistique d'un parcours
    praticien/                         File « À traiter », liste, fiche patient (« À retenir », compte rendu, notes, suivi)
    patient/                           Tableau de bord, questionnaire, « Mes données », export agenda (.ics)
    compte-rendu/[id]/                 Compte rendu imprimable en PDF (patient, équipe)
    partage/[token]/                   Bilan partagé avec un praticien hors équipe
  lib/
    schema.ts    Modèle relationnel (SQL)
    pathway.ts   Règles du parcours : phases, étape en cours, étapes optionnelles, catalogue
    queries.ts   Lectures avec autorisation (3 rôles + partage externe)
    seed.ts      Jeu de données fictif (9 coureurs dont le compte du jury, 8 praticiens, 1 coordinatrice)
    domain.ts    Professions, offres, questionnaire, dimensions du bilan
    auth.ts      Session signée HMAC (cookie httpOnly)
```

**Modèle de données.**
- `pathways` et `pathway_steps` décrivent le parcours type, en deux phases (bilan, puis parcours coordonné).
- `step_catalog` liste les étapes ajoutables selon les besoins.
- `enrollments` porte l'offre, le statut, l'échéance de coordination et l'opposition.
- `care_team` porte le statut de chaque praticien : proposé, accepté ou refusé.
- `enrollment_steps` contient le plan propre à chaque patient.
- Le reste : `sessions`, `reports`, `external_shares`, `notes`, `checkins`, `intake_forms`, `relances`, `access_logs`, et pour la connexion `credentials` (mots de passe hachés) et `auth_logs`.

**Choix techniques.**
- Next.js 16 (Server Components, Server Actions) et Tailwind CSS 4.
- PostgreSQL : Supabase (région UE) via `DATABASE_URL`, sinon PGlite embarqué ; même schéma et mêmes requêtes dans les deux cas.
- Déploiement Vercel : la base de démo est recréée à chaque démarrage à froid.

## Scénario de démonstration (≈ 8 min)

**Compte du jury** : `jury.demo@exemple.fr`, avec le mot de passe de démonstration commun. C'est un coureur qui vient de s'inscrire : à la connexion, il arrive sur son questionnaire. Le compte fait partie des données de démo, donc la réinitialisation le recrée à l'identique. Une vidéo de 2 minutes, sans voix off, montre sa création (inscription, mot de passe refusé puis accepté, questionnaire, reconnexion).

Avant de commencer : « Réinitialiser les données de démo » sur `/connexion` (environ 30 secondes), puis retour à l'accueil. Pour changer de profil : « Se déconnecter », « Se connecter », choisir l'espace, puis un clic sur le compte fictif remplit le formulaire.

0. **Un nouveau coureur** : sur la page d'accueil, « Commencer mon bilan ».
   - Inscription avec des informations fictives et un mot de passe : un mot de passe trop faible est refusé, puis on arrive directement sur le questionnaire.
   - « Suivant » sans répondre : les questions obligatoires sont signalées.
   - Répondre à la première page, puis « Enregistrer et finir plus tard ».
1. **Lucie Fontaine (coordination)** : sa file « À traiter » s'affiche en premier.
   - Le nouveau coureur apparaît avec « Questionnaire non envoyé ».
   - Hugo n'a pas rempli son questionnaire (déjà relancé) : un clic ouvre directement la section Relances.
   - Léa attend de valider une sophrologue.
   - Ouvrir un parcours : aucune donnée clinique.
2. **Chloé Bernard (patiente)** : son bilan est terminé ; le bloc « À faire » lui propose la suite, elle choisit « Je continue » (parcours coordonné).
3. **Lucie** : propose Camille Nguyen (podologue) et ajoute l'étape « Bilan podologique ».
4. **Chloé** : accepte la podologue.
5. **Lucie** : planifie le bilan podologique.
6. **Camille Nguyen (podologue)** : voit maintenant Chloé.
   - L'alimentation et le volet mental sont masqués ; le bilan du kiné est visible.
   - Ouvrir `/praticien/patients/pa-hugo` (patient hors équipe) : accès refusé et tracé.
7. **Julien Petit (kiné)** : ouvre Sophie.
   - Le bandeau « À retenir » affiche d'emblée le point d'attention « douleur thoracique » ; la téléconsultation médicale est maintenue.
   - Il rédige et remet le compte rendu ; les étapes du bilan se valident. Ouvrir le PDF.
8. **Marc Dubois (patient)** : son bilan est partagé avec sa kiné habituelle, et le journal montre l'ouverture du lien.
9. *(Option, sur téléphone)* **Léa Martin (patiente)** : « À faire », suivi de la semaine en quelques touches, « Ajouter à mon agenda » sur sa prochaine séance.

## Limites et suites

- **Authentification :** email, mot de passe (CNIL 2022-100) et code à usage unique (double authentification). En production : envoyer le code par un vrai service d'email ou de SMS, passer les praticiens sur Pro Santé Connect / e-CPS, supprimer le mot de passe de démonstration commun et ajouter la réinitialisation par email. L'inscription ouvre encore la session sans code : la vérification de l'adresse email serait à ajouter.
- **Paiement non intégré :** l'offre à 150 € est seulement affichée ; pas de vrai rendez-vous en ligne non plus.
- **Base de démo éphémère :** elle est recréée sur Vercel. En production : PostgreSQL chez un hébergeur HDS.
- **Pistes :**
  - rappels de séance par SMS ou email ;
  - messagerie sécurisée ;
  - agendas des praticiens ;
  - téléconsultation intégrée ;
  - indicateurs par parcours ;
  - export du dossier.
