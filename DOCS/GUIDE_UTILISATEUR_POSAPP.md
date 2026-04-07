# Guide Utilisateur POSapp

## Table des matieres

1. [Presentation generale](#1-presentation-generale)
2. [Principes metier a retenir](#2-principes-metier-a-retenir)
3. [Profils utilisateurs](#3-profils-utilisateurs)
4. [Demarrage d'une nouvelle instance](#4-demarrage-dune-nouvelle-instance)
5. [Configuration initiale pas a pas](#5-configuration-initiale-pas-a-pas)
6. [Catalogue produits, articles et fiches techniques](#6-catalogue-produits-articles-et-fiches-techniques)
7. [Flux achat](#7-flux-achat)
8. [Flux ravitaillement depot-vers-boutique](#8-flux-ravitaillement-depot-vers-boutique)
9. [Flux vente et caisse](#9-flux-vente-et-caisse)
10. [Programme bonus client](#10-programme-bonus-client)
11. [Inventaire, ajustements et retours](#11-inventaire-ajustements-et-retours)
12. [Procedures par role](#12-procedures-par-role)
13. [Bonnes pratiques d'exploitation](#13-bonnes-pratiques-dexploitation)
14. [Erreurs frequentes et interpretation](#14-erreurs-frequentes-et-interpretation)
15. [Resume operationnel](#15-resume-operationnel)

## 1. Presentation generale

POSapp est une application de gestion commerciale, de stock et de caisse.

Elle couvre principalement :

- la configuration des boutiques et des zones de stock
- la gestion des utilisateurs et des permissions
- la creation des produits composants et des articles vendus
- les demandes d'achat et les commandes fournisseur
- les entrees, sorties, requisitions et transferts de stock
- la caisse et les ventes
- les rapports, tableaux de bord et suivis d'exploitation

POSapp est generalement utilise avec 2 interfaces :

- `Admin Panel` : interface de configuration, pilotage et gestion
- `Front Office / Caisse` : interface de vente et d'operations boutique

## 2. Principes metier a retenir

### 2.1 Article et composant

Dans POSapp :

- un `article` est ce que le client voit et achete
- un `produit composant` est ce qui existe physiquement en stock

Exemple :

- article : `Paquet de biscuit`
- fiche technique : `1 paquet = 12 biscuits`
- vente de `2 paquets` = consommation de `24 biscuits`

Regle cle :

`On vend des articles, mais on stocke, on achete, on transfere et on consomme des composants.`

### 2.2 Depot et boutique

Le stock est organise par zones.

Les types de zones les plus utiles sont :

- `WAREHOUSE` : depot central
- `STORE` : stock boutique de vente
- `COUNTER` : zone caisse si votre organisation en utilise une

Regle recommandee dans ce projet :

- le depot central sert a ravitailler
- la boutique vend depuis sa zone `STORE`
- le caissier ne vend pas depuis le depot

### 2.3 Requisition

Quand le stock boutique devient insuffisant :

- la boutique cree une requisition
- le depot prepare le ravitaillement
- un transfert de stock est ensuite effectue du depot vers la boutique

### 2.4 Vente

Lors d'une vente :

- l'utilisateur selectionne un article
- le systeme lit la fiche technique de cet article
- le systeme calcule les composants necessaires
- le stock est deduit dans la zone de vente de la boutique

## 3. Profils utilisateurs

Les roles peuvent varier selon votre configuration, mais en pratique on retrouve :

- `SUPERADMIN` : configuration globale et administration complete
- `ADMIN` : gestion centralisee des parametres, du catalogue et des documents
- `MANAGER` ou `GESTIONNAIRE` : suivi de boutique, validation et supervision operationnelle
- `USER`, `VENDEUR` ou `CAISSIER` : operations de vente et taches quotidiennes en boutique

## 4. Demarrage d'une nouvelle instance

Pour une nouvelle mise en place, l'ordre recommande est le suivant :

1. Creer les boutiques
2. Creer les zones de stock
3. Creer les unites
4. Configurer les devises
5. Configurer les profils de permissions
6. Creer les utilisateurs
7. Creer les produits composants
8. Creer les articles
9. Definir les fiches techniques
10. Creer les demandes d'achat si necessaire
11. Creer les commandes fournisseur
12. Enregistrer les entrees de stock depot
13. Creer les requisitions boutique
14. Finaliser les transferts depot vers boutique
15. Ouvrir la caisse
16. Commencer les ventes

## 5. Configuration initiale pas a pas

### 5.1 Creer les boutiques

Creer :

- le depot principal si vous le gerez comme point logistique
- les boutiques operationnelles

### 5.2 Creer les zones de stock

Pour chaque boutique, creer les zones necessaires.

Exemple de structure simple :

- depot principal : une zone `WAREHOUSE`
- boutique de vente : une zone `STORE`

### 5.3 Creer les unites

Configurer les unites selon vos besoins :

- unite de gestion
- unite de stock
- unite de dosage

### 5.4 Configurer les devises

Si vous utilisez plusieurs devises :

- definir la devise principale
- definir la devise secondaire si necessaire
- verifier les regles de conversion

### 5.5 Configurer les permissions et utilisateurs

Pour chaque utilisateur, verifier :

- son role
- sa boutique
- sa zone par defaut si elle est utilisee
- son profil de permissions

## 6. Catalogue produits, articles et fiches techniques

### 6.1 Produits composants

Les produits composants sont les elements physiques du stock.

Exemples :

- biscuit
- blister
- capsule
- flacon

Ce sont eux qui seront :

- achetes
- recus en stock
- transferes
- ajustes
- consommes lors des ventes

### 6.2 Articles

Les articles sont les references commerciales proposees au client.

Exemples :

- paquet de biscuit
- kit de traitement
- boite promotionnelle

### 6.3 Fiche technique

Chaque article doit etre lie a ses composants.

Exemple :

- article : `Paquet de biscuit`
- composant : `Biscuit`
- quantite : `12`

Si une fiche technique manque :

- l'article ne doit pas etre utilise en vente
- les calculs de stock risquent d'etre incoherents

### 6.4 Code scan article

Un article peut recevoir un `Code scan`.

Ce champ permet :

- d'enregistrer le code QR ou code-barres de l'article
- de retrouver l'article instantanement a la caisse
- d'ajouter l'article au panier lors d'un scan

Le `Code scan` est disponible :

- dans le formulaire article
- dans la liste des articles
- dans le template XLSX d'import d'articles

## 7. Flux achat

Le flux achat suit generalement cette sequence :

`Demande d'achat -> Commande fournisseur -> Entree de stock`

### 7.1 Demande d'achat

La demande d'achat exprime un besoin d'approvisionnement.

Important :

- l'utilisateur peut raisonner en article
- le systeme convertit ensuite en composants

Exemple :

- demande : `2 paquets de biscuit`
- enregistrement reel : `24 biscuits`

### 7.2 Commande fournisseur

La commande fournisseur doit porter sur les produits physiques.

Donc :

- on commande les composants
- pas les articles composes

### 7.3 Entree de stock

L'entree de stock enregistre la reception fournisseur.

Elle doit contenir autant que possible :

- les composants recus
- les quantites
- le cout unitaire
- le lot
- la date d'expiration si applicable

## 8. Flux ravitaillement depot vers boutique

Le flux de ravitaillement suit en general cette sequence :

`Requisition -> Validation -> Transfert -> Stock boutique`

### 8.1 Requisition

Quand une boutique manque de stock :

- elle cree une requisition
- elle peut raisonner en article
- le systeme convertit la demande en composants

Exemple :

- requisition : `2 paquets de biscuit`
- besoin reel : `24 biscuits`

### 8.2 Validation

Selon votre workflow :

- la requisition peut etre soumise
- puis approuvee
- puis transformee en transfert

### 8.3 Transfert

Le transfert deplace les composants :

- depuis la zone `WAREHOUSE`
- vers la zone `STORE` de la boutique cible

Le stock ne change reellement que lorsque le transfert est finalise selon le workflow en place.

## 9. Flux vente et caisse

### 9.1 Ouverture de caisse

Avant de vendre :

- ouvrir la caisse
- verifier que la session pointe vers la bonne boutique
- verifier que la zone utilisee est bien la zone `STORE`

### 9.2 Vente d'un article

Le caissier selectionne un article dans la caisse.

Le systeme :

- verifie la fiche technique
- calcule les composants necessaires
- controle la disponibilite en stock boutique
- deduit les composants du stock reel

Exemple :

- article : `Paquet de biscuit`
- fiche technique : `12 biscuits`
- vente : `2 paquets`
- deduction stock : `24 biscuits`

### 9.3 Ajout au panier par scan

La caisse permet d'ajouter un article au panier par scan.

Principe :

- le scanner envoie le code dans le champ de recherche
- le systeme cherche une correspondance exacte sur `Code scan`
- a defaut, il peut aussi reconnaitre le `SKU`
- si l'article est trouve, il est ajoute au panier

Conditions importantes :

- l'article doit exister
- la fiche technique doit etre valide
- le stock disponible doit etre suffisant

## 10. Programme bonus client

Le programme bonus client permet de recompenser les achats selon des regles simples.

### 10.1 Signification des champs

- `Montant seuil` : montant minimum d'achat a atteindre pour declencher l'attribution de points
- `Points attribues` : nombre de points accordes lorsque le montant seuil est atteint
- `Equivalent montant d'un point` : valeur monetaire d'un point
- `Quota de points` : plafond ou objectif de points sur une periode definie
- `Prime en montant` : recompense financiere accordee quand le quota de points est atteint

### 10.2 Exemple de configuration

Exemple :

- `Montant seuil = 20`
- `Points attribues = 5`
- `Equivalent montant d'un point = 0.2`
- `Quota de points = 100`
- `Prime en montant = 10`

Cela signifie :

- a chaque achat de `20` ou plus, le client gagne `5 points`
- `1 point` vaut `0.2`
- a l'atteinte de `100 points` sur la periode definie, le client recoit une prime de `10`

### 10.3 Resume rapide

- `Montant seuil` = a partir de combien on recompense
- `Points attribues` = combien de points on donne
- `Equivalent montant d'un point` = combien vaut 1 point
- `Quota de points` = limite ou objectif de points
- `Prime en montant` = recompense accordee a l'atteinte du quota

## 11. Inventaire, ajustements et retours

### 11.1 Ajustement de stock

Utiliser un ajustement pour :

- corriger une quantite
- regulariser un ecart
- mettre a jour un niveau theorique

### 11.2 Inventaire physique

L'inventaire physique sert a :

- comparer le stock theorique au stock reel
- identifier les ecarts
- valider les corrections

### 11.3 Retour stock

Le retour stock sert a reintegrer des quantites dans une zone selon votre procedure interne.

### 11.4 Retour fournisseur

Le retour fournisseur sert a :

- sortir un composant vers un fournisseur
- gerer le defectueux, la casse ou un retour commercial

## 12. Procedures par role

### 12.1 Procedure quotidienne du SUPERADMIN ou ADMIN

Au debut de la journee :

1. Verifier le tableau de bord
2. Verifier les alertes stock et expiration
3. Verifier les documents en attente de validation

En cours de journee :

1. Creer ou mettre a jour les utilisateurs si necessaire
2. Mettre a jour le catalogue si besoin
3. Suivre les commandes fournisseur
4. Suivre les requisitions et transferts

En fin de journee :

1. Controler les ventes et encaissements
2. Controler les ecarts de stock signales
3. Exporter les rapports utiles

### 12.2 Procedure du gestionnaire de stock ou manager

Au debut de la journee :

1. Verifier le stock depot
2. Verifier le stock boutique
3. Controler les requisitions recues

Pendant l'exploitation :

1. Traiter les demandes d'achat
2. Preparer les entrees de stock depot
3. Preparer les transferts depot vers boutique
4. Finaliser les mouvements de stock selon le workflow

En fin de journee :

1. Verifier les transferts non finalises
2. Verifier les mouvements en erreur
3. Lancer les ajustements si necessaire

### 12.3 Procedure quotidienne du caissier

Au debut de la journee :

1. Se connecter
2. Ouvrir la caisse
3. Verifier que la caisse pointe bien sur la bonne boutique
4. Verifier que le stock boutique est suffisant

Pendant la vente :

1. Rechercher ou scanner l'article
2. Ajouter l'article au panier
3. Verifier les quantites
4. Encaisser la vente

Si un article manque :

1. Verifier qu'il existe encore dans le stock boutique
2. Si besoin, creer une requisition de ravitaillement

En fin de journee :

1. Verifier les ventes du jour
2. Cloturer ou fermer la caisse selon votre procedure
3. Signaler toute anomalie de stock ou de paiement

## 13. Bonnes pratiques d'exploitation

- toujours creer les composants avant les articles
- ne jamais utiliser un article comme stock physique
- verifier qu'une fiche technique existe avant la vente
- verifier que la boutique est ravitaillee avant l'ouverture de caisse
- utiliser la requisition pour les besoins boutique
- utiliser le depot comme source de ravitaillement et non comme zone de vente
- controler les validations de workflow avant de conclure qu'un stock a bouge
- renseigner le `Code scan` des articles pour accelerer le passage en caisse
- garder une nomenclature claire pour les composants, articles et zones

## 14. Erreurs frequentes et interpretation

### `Target store/zone required`

Signifie generalement :

- zone cible manquante
- boutique cible non resolue

### `Stock insuffisant pour ...`

Signifie :

- la zone source ne contient pas assez de composants pour finaliser le mouvement

### `Password change required`

Signifie :

- l'utilisateur est en premiere connexion

### Aucun mouvement visible apres creation

Souvent, cela signifie :

- le document a ete cree
- mais il n'a pas encore ete valide, comptabilise ou finalise

### L'article ne passe pas au scan

Verifier :

- que l'article possede un `Code scan`
- que le code lu correspond exactement a la valeur enregistree
- que la fiche technique de l'article est correcte
- que le stock boutique n'est pas a zero

## 15. Resume operationnel

Schema simple a retenir :

`Demande d'achat -> Commande fournisseur -> Entree depot -> Requisition boutique -> Transfert depot vers boutique -> Vente caisse`

Phrase cle :

`On vend des articles, mais on gere le stock reel uniquement en composants.`
