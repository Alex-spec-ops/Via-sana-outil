# Via Sana — outil de suivi des parcours de soins coordonnés

Prototype fonctionnel pour suivre un patient dans le parcours **« Préparation Marathon »** (médecin généraliste, kinésithérapeute, ostéopathe, diététicien·ne), avec une interface praticien et une interface patient simplifiée.

**Démo en ligne : https://via-sana-outil.vercel.app**

> Toutes les données sont **fictives**. Le prototype n'est pas un dispositif médical.

## Lancer le projet

Prérequis : **Node.js ≥ 22.13** (utilise le module natif `node:sqlite`, aucune base à installer).

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 et choisir un profil fictif. La base SQLite est créée et remplie automatiquement au premier lancement dans `data/via-sana.db`. Le bouton « Réinitialiser les données de démo » (page d'accueil) remet le jeu de données à zéro.

## Ce que fait l'outil

**Interface praticien**
- Liste des patients **limitée à ceux dont le praticien fait partie de l'équipe de soins**, avec recherche et filtres par parcours, statut et étape en cours, plus un filtre « à surveiller » (formulaire non rempli, douleur ≥ 5/10, parcours en pause).
- Fiche patient : identité, objectif et échéance (J-x), progression, équipe de soins, timeline des étapes (réalisées / en cours / à venir), séances à venir et historique, notes de suivi, suivi hebdomadaire déclaré par le patient, formulaire préalable, journal des accès.
- Actions : ajouter une note (visibilité équipe / privée / patient), démarrer ou clôturer une étape avec un compte rendu (l'étape suivante devient « en cours »), planifier / clôturer / annuler une séance, changer le statut du parcours.

**Interface patient**
- Tableau de bord : objectif et compte à rebours, progression, étape en cours, prochaines séances, timeline du parcours, conseils de l'équipe.
- Formulaire préalable : brouillon, envoi (valide automatiquement la 1re étape), consultation et modification.
- Suivi hebdomadaire : kilomètres, douleur, fatigue, commentaire — visible par l'équipe.
- « Mes données » : équipe de soins, matrice de ce que chaque profession voit du formulaire, **opposition au partage** activable/révocable, **journal de qui a consulté le dossier**.

## Protection des données : du texte de loi au code

Analyse détaillée et sources Légifrance : [`docs/brief-et-cadre-juridique.md`](docs/brief-et-cadre-juridique.md).

| Exigence | Source | Implémentation |
|---|---|---|
| Accès réservé aux professionnels qui participent à la prise en charge | CSP L1110-4, L1110-12 | Table `care_team` ; chaque lecture et chaque action serveur vérifie l'appartenance (`src/lib/queries.ts`, `src/app/actions.ts`). Un accès hors équipe affiche « Accès refusé » et est journalisé. |
| Partage limité aux informations **strictement nécessaires** | CSP L1110-4 II-III | Formulaire découpé en sections avec une liste de professions destinataires (`src/lib/domain.ts`) : le kiné ne voit pas l'alimentation, la diététicienne ne voit pas les blessures. Notes « privées » réservées à leur auteur. |
| Droit d'opposition au partage, à tout moment | CSP L1110-4 IV | Bouton côté patient ; chaque praticien ne voit alors plus que ses propres notes, avec un bandeau explicatif. |
| Cloisonnement des dossiers et journalisation exploitée | CNIL SAN-2026-009, recommandation journalisation | Table `access_logs` (accès autorisés **et refusés**), visible par le patient et par l'équipe. |
| Hébergement certifié HDS, en UE | CSP L1111-8 | Hors périmètre du prototype (données fictives) ; prévu pour la production. |
| Pas de mise en cache de données de santé | Sécurité (RGPD art. 32) | Rendu 100 % dynamique, `Cache-Control: no-store`, `noindex`, `X-Frame-Options: DENY` (`next.config.ts`). |
| Clôture d'une étape par la profession concernée | Responsabilité de chaque professionnel | Seule la profession de l'étape (ou le médecin référent) peut la marquer réalisée. |

## Architecture

```
src/
  app/
    page.tsx                         Choix du profil (démo)
    actions.ts                       Server Actions : toutes les écritures, avec contrôle d'accès
    praticien/page.tsx               Liste + filtres + agenda
    praticien/patients/[id]/page.tsx Fiche patient
    patient/page.tsx                 Tableau de bord patient
    patient/formulaire/page.tsx      Formulaire préalable
    patient/confidentialite/page.tsx Équipe, opposition, journal des accès
  lib/
    schema.ts   Modèle relationnel (SQL)
    seed.ts     Jeu de données fictif, dates relatives à « aujourd'hui »
    db.ts       Connexion node:sqlite
    auth.ts     Session signée HMAC (cookie httpOnly)
    queries.ts  Lectures avec autorisation (équipe de soins, visibilité des notes, sections du formulaire)
    domain.ts   Types, libellés, définition du formulaire préalable
  components/   Timeline, tableaux, badges…
  proxy.ts      Redirection optimiste des visiteurs non connectés
```

**Modèle de données** : `pathways` et `pathway_steps` décrivent le parcours type. `enrollments` relie un patient à un parcours (objectif, statut, opposition). `care_team` matérialise l'équipe de soins. `enrollment_steps` suit l'avancement de chaque étape. Les tables `sessions`, `notes`, `checkins`, `intake_forms` et `access_logs` complètent le modèle.

Le parcours est un **modèle réutilisable** : un second parcours (« Reprise de la course après blessure ») est fourni pour montrer qu'on gère plusieurs parcours et plusieurs patients en parallèle.

**Choix techniques** : Next.js 16 (App Router, Server Components, Server Actions), Tailwind CSS 4, SQLite via `node:sqlite`. Le serveur porte toute la logique d'autorisation, rien n'est exposé au navigateur sans contrôle. SQLite rend la démo autonome ; le schéma SQL se transpose tel quel à PostgreSQL (hébergeur HDS) pour la production.

## Scénario de démonstration (≈ 5 min)

1. **Julien Petit (kiné)** : il voit 5 patients sur 8. Il ouvre Léa Martin : la section « alimentation » est masquée, et la note privée de l'ostéopathe n'apparaît pas. Il clôture « Point mi-parcours kiné » avec un compte rendu, et l'étape suivante passe « en cours ».
2. Toujours en Julien, ouvrir l'URL `/praticien/patients/pa-karim` (patient suivi par une autre kiné) : **accès refusé et journalisé**.
3. **Hugo Lambert (patient)** : il remplit et envoie son formulaire (la 1re étape est validée), déclare une douleur de 6/10, puis s'oppose au partage dans « Mes données ».
4. **Dr Claire Morel** : Hugo apparaît dans « À surveiller ». Sa fiche affiche le bandeau d'opposition, et le journal montre toutes les actions précédentes.

## Limites et suites

- Authentification de démo (choix de profil). En production : Pro Santé Connect / e-CPS pour les praticiens, identifiant + double facteur pour les patients.
- Base de démo réinitialisée à chaque démarrage à froid sur un hébergement serverless. En production : PostgreSQL chez un hébergeur certifié HDS, chiffrement au repos, sauvegardes.
- Pistes : rappels de séance (email/SMS), messagerie sécurisée équipe ↔ patient, prise de rendez-vous en ligne, éditeur de parcours types, export du dossier (droit d'accès), politique de conservation alignée sur le statut juridique du centre.
