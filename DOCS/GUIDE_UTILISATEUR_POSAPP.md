# Guide Utilisateur POSapp

## 1. Objectif de l'application

POSapp est une application de gestion commerciale et de stock organisee autour de 2 idees simples :

- on vend des `articles`
- on stocke, on achete, on transfere et on consomme des `produits composants`

Exemple :

- article : `Paquet de biscuit`
- fiche technique : `1 paquet = 12 biscuits`
- vente de `2 paquets` = sortie de `24 biscuits`

L'application couvre principalement :

- la configuration initiale
- la gestion des utilisateurs
- le catalogue articles et produits
- les demandes d'achat
- les commandes fournisseur
- les entrees et sorties de stock
- les requisitions et transferts depot -> boutique
- la caisse et les ventes
- les rapports et le suivi

## 2. Les espaces de travail

POSapp est generalement utilise avec 2 interfaces :

### Admin Panel

Utilise par :

- super administrateur
- administrateur
- gestionnaire

Permet de :

- configurer l'application
- gerer le catalogue
- creer les documents d'achat et de stock
- suivre les workflows
- consulter les rapports

### Front Office / Caisse

Utilise par :

- vendeur
- caissier

Permet de :

- ouvrir la caisse
- vendre les articles
- consulter les stocks utiles a la vente
- creer une requisition de ravitaillement si besoin

## 3. Logique metier a retenir

Avant toute utilisation, il faut retenir ces regles :

### 3.1 Articles et composants

- un `article` est ce que le client achete
- un `produit composant` est ce qui existe physiquement en stock

### 3.2 Depot et boutique

- le `depot` est le stock central
- la `boutique` est le stock de vente
- le caissier ne vend pas depuis le depot
- le caissier vend uniquement depuis le stock `boutique`

### 3.3 Requisition

- quand la boutique manque de stock, elle fait une `requisition`
- la requisition sert a demander un ravitaillement du depot vers la boutique

### 3.4 Vente

- la vente part d'un article
- le systeme convertit automatiquement l'article en composants selon la fiche technique

## 4. Demarrage et premiere connexion

### 4.1 Connexion

Lors de la premiere connexion :

- connectez-vous avec l'identifiant recu
- utilisez le mot de passe temporaire
- changez votre mot de passe si l'application le demande

### 4.2 Verification apres connexion

Apres connexion, verifiez :

- votre role
- votre boutique rattachee
- votre zone de stock par defaut si elle est utilisee
- vos permissions

## 5. Configuration initiale

L'ordre conseille pour configurer POSapp est le suivant.

### 5.1 Creer les boutiques

Menu conseille :

- `Configurations`
- `Parametres`
- `Locale de vente`

Creer :

- le depot principal si vous le gerez comme boutique logistique
- les boutiques operationnelles

### 5.2 Creer les zones de stock

Pour chaque boutique, creer les zones utiles.

Types les plus importants :

- `WAREHOUSE` : depot central
- `STORE` : stock boutique
- `COUNTER` : zone caisse si vous en utilisez une

Regle recommandee :

- depot central = zone `WAREHOUSE`
- boutique de vente = zone `STORE`

### 5.3 Creer les unites

Creer les unites selon votre besoin :

- unite de vente
- unite de stock
- unite de dosage

### 5.4 Configurer les devises

Si vous travaillez avec plusieurs devises :

- definir la devise principale
- definir la devise secondaire
- enregistrer les conversions si necessaire

### 5.5 Configurer les profils de permissions et utilisateurs

Creer si besoin :

- les profils de permissions
- les utilisateurs
- l'affectation par role et par boutique

Exemples :

- `SUPERADMIN`
- `ADMIN`
- `MANAGER`
- `USER`

## 6. Gestion des utilisateurs

### 6.1 Creer un utilisateur

Renseigner :

- email ou telephone
- prenom et nom
- role
- boutique
- zone par defaut si necessaire
- profil de permissions

Le systeme :

- cree le compte
- genere un mot de passe temporaire
- peut envoyer les informations par email ou SMS

### 6.2 Bonnes pratiques

- affecter le vendeur a la bonne boutique
- eviter d'utiliser une zone de depot pour un vendeur
- reserver les permissions sensibles aux administrateurs

## 7. Catalogue : produits, articles et fiche technique

### 7.1 Produits composants

Creer d'abord les `produits composants`.

Exemples :

- biscuit
- blister
- flacon
- capsule

Ce sont eux qui seront :

- achetes
- stockes
- transferes
- ajustes

### 7.2 Articles

Creer ensuite les `articles` vendus au client.

Exemples :

- paquet de biscuit
- kit de traitement
- boite promotionnelle

### 7.3 Fiche technique

Associer ensuite les composants a l'article.

Exemple :

- article : `Paquet de biscuit`
- composant : `Biscuit`
- quantite composant : `12`

Sans fiche technique :

- l'article ne doit pas etre utilise pour la vente ou les flux dependants

## 8. Flux achat

Le flux achat est le suivant :

`Demande d'achat -> Commande fournisseur -> Entree stock`

### 8.1 Demande d'achat

Une demande d'achat sert a exprimer un besoin d'approvisionnement.

Important :

- l'utilisateur peut saisir un article
- le systeme le convertit en composants avant enregistrement

Exemple :

- demande : `2 paquets de biscuit`
- enregistrement reel : `24 biscuits`

### 8.2 Commande fournisseur

La commande fournisseur doit porter sur des produits physiques.

Donc :

- on commande les `composants`
- pas les articles composes

### 8.3 Entree de stock

L'entree de stock enregistre la reception fournisseur.

Elle doit se faire sur :

- les composants
- avec les quantites recues
- et, si possible, les informations de lot, cout et expiration

## 9. Flux ravitaillement depot -> boutique

Le flux de ravitaillement est :

`Requisition -> Transfert -> Stock boutique`

### 9.1 Requisition

Quand la boutique manque de stock :

- elle cree une requisition
- elle peut saisir un article ou un besoin metier equivalent
- le systeme convertit en composants

Exemple :

- requisition : `2 paquets de biscuit`
- besoin reel : `24 biscuits`

### 9.2 Validation de la requisition

Selon votre workflow :

- la requisition peut etre approuvee
- puis transformee en transfert

### 9.3 Transfert

Le transfert deplace les composants :

- depuis la zone `WAREHOUSE`
- vers la zone `STORE` de la boutique

Le stock ne change reellement que lorsque le transfert est finalise ou valide selon le workflow.

## 10. Flux vente

### 10.1 Ouverture de caisse

Avant de vendre :

- ouvrir la caisse
- verifier que la session utilise bien la zone `STORE` de la boutique

### 10.2 Vente

Le vendeur selectionne un article.

Le systeme :

- calcule la quantite de composants necessaire
- verifie le stock disponible en boutique
- deduit les composants du stock boutique

Exemple :

- article : `Paquet de biscuit`
- fiche technique : `12 biscuits`
- vente : `2 paquets`
- deduction en stock : `24 biscuits`

### 10.3 Point essentiel

Le vendeur ne vend pas depuis :

- le depot
- ni le stock global du tenant

Il vend depuis :

- le stock `STORE` de sa boutique

## 11. Inventaire, ajustement et retours

### 11.1 Ajustement de stock

Utilise pour :

- corriger une quantite
- regulariser un ecart
- reinitialiser un niveau theorique

### 11.2 Inventaire physique

Utilise pour :

- comparer le stock theorique au stock reel
- valider les ecarts
- cloturer avec correction si necessaire

### 11.3 Retour stock

Utilise pour :

- reintegrer un stock dans une zone

### 11.4 Retour fournisseur

Utilise pour :

- sortir des composants vers un fournisseur
- gerer la casse, le defectueux ou les retours commerciaux

## 12. Rapports et dashboard

Les ecrans de pilotage permettent de suivre :

- le nombre de produits actifs
- les entrees et sorties de stock
- le cout des ventes
- la repartition du stock par boutique
- les alertes de peremption

Apres un reset de base ou sur une base vide :

- le dashboard peut afficher des valeurs nulles
- c'est normal tant qu'il n'y a pas encore de donnees metier

## 13. Ordre recommande de mise en place

Pour lancer une nouvelle instance, suivre cet ordre :

1. Creer les boutiques
2. Creer les zones de stock
3. Creer les unites
4. Configurer les devises
5. Creer les profils de permissions
6. Creer les utilisateurs
7. Creer les produits composants
8. Creer les articles
9. Definir les fiches techniques
10. Creer les demandes d'achat si besoin
11. Creer les commandes fournisseur
12. Enregistrer les entrees en stock depot
13. Creer les requisitions boutique
14. Finaliser les transferts depot -> boutique
15. Ouvrir la caisse
16. Vendre les articles

## 14. Bonnes pratiques d'utilisation

- toujours creer les composants avant les articles
- ne pas utiliser un article comme stock physique
- verifier qu'une fiche technique existe avant la vente
- verifier que la boutique est bien ravitaillee avant l'ouverture de caisse
- utiliser la requisition pour les besoins boutique
- utiliser le depot comme source de ravitaillement, pas comme zone de vente
- controler les validations de workflow avant de conclure qu'un stock a bouge

## 15. Erreurs frequentes et interpretation

### `Target store/zone required`

Signifie generalement :

- zone cible manquante
- boutique cible non resolue

### `Stock insuffisant pour ...`

Signifie :

- le depot ou la zone source ne contient pas assez de composants pour finaliser le transfert

### `Password change required`

Signifie :

- l'utilisateur est en premiere connexion

### Aucun mouvement visible apres creation

Souvent, cela signifie :

- le document a ete cree
- mais pas encore comptabilise, valide ou finalise

## 16. Resume metier en une phrase

`On vend des articles, mais on achete, on stocke, on transfere et on consomme seulement des composants.`

