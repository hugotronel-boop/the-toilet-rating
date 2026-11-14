# THE TOILET RATING 💩

Mini-site de notation avec classement public, commentaires et espace administrateur privé.

## Contenu

- `index.html` : formulaire public + statistiques + classement + derniers commentaires
- `admin.html` : connexion et tableau de bord administrateur
- `app.js` / `admin.js` : logique du site
- `styles.css` : thème premium noir, crème et or
- `config.js` : URL et clé publique Supabase
- `supabase/schema.sql` : tables, fonctions et règles de sécurité

## 1. Créer la base Supabase

1. Créez un projet sur https://supabase.com/.
2. Dans le projet, ouvrez **SQL Editor** puis **New query**.
3. Copiez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.
4. Ouvrez **Project Settings > API** (ou **Data API / API Keys**, selon l'interface).
5. Copiez l'URL du projet et la clé publique `anon` ou `publishable`.

La clé publique est prévue pour être utilisée dans un site web. **Ne copiez jamais la clé `service_role` ou une clé secrète dans le site.**

## 2. Configurer le site

Ouvrez `config.js` et remplacez les deux valeurs :

```js
export const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
export const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_OU_PUBLISHABLE";
```

Enregistrez le fichier.

## 3. Créer le compte administrateur

1. Dans Supabase, ouvrez **Authentication > Users**.
2. Cliquez sur **Add user** et créez votre compte avec votre adresse e-mail et un mot de passe solide.
3. Ouvrez la fiche de l'utilisateur et copiez son **User UID**.
4. Dans **SQL Editor**, exécutez cette requête en remplaçant l'UUID :

```sql
insert into public.admin_users (user_id)
values ('COLLEZ-ICI-LE-USER-UID')
on conflict do nothing;
```

5. L'espace privé sera accessible sur `https://VOTRE-SITE/admin.html`.

La création d'un compte Supabase ne suffit pas à donner les droits administrateur : l'UUID doit aussi être présent dans `admin_users`.

## 4. Publier gratuitement avec GitHub Pages

1. Créez un dépôt GitHub, par exemple `the-toilet-rating`.
2. Envoyez tous les fichiers de ce dossier à la racine du dépôt, en conservant le dossier `supabase`.
3. Dans GitHub, ouvrez **Settings > Pages**.
4. Dans **Build and deployment**, choisissez **Deploy from a branch**.
5. Sélectionnez `main` et `/ (root)`, puis **Save**.
6. Attendez la publication. GitHub affichera l'adresse du site.
7. Ouvrez l'adresse publique sur un téléphone et faites un test.

Le site utilise des modules JavaScript et l'API Supabase ; il doit être servi en HTTPS (GitHub Pages le fait automatiquement). Ne l'ouvrez pas uniquement en double-cliquant sur `index.html`.

## 5. Programmer la pastille NFC

Avec NFC Tools sur iPhone :

1. Ouvrez **Écrire**.
2. Touchez **Ajouter un enregistrement**.
3. Choisissez **URL / URI**.
4. Collez l'adresse publique de votre site, par exemple `https://votre-pseudo.github.io/the-toilet-rating/`.
5. Touchez **Écrire**, puis approchez l'iPhone de la pastille.

Vous pouvez aussi imprimer un QR code avec la même adresse pour les téléphones qui ne lisent pas le NFC.

## Sécurité et confidentialité

- Les visiteurs n'ont pas de compte à créer.
- Les visiteurs ne peuvent pas lire directement la table `ratings`.
- L'envoi passe par une fonction SQL qui valide les notes et limite les envois rapprochés avec le même surnom.
- Le classement public n'expose que les surnoms, les moyennes, le nombre de passages et la date du dernier passage.
- Les commentaires sont publics. Demandez aux participants de ne pas inscrire de nom complet, numéro, adresse ou autre information personnelle.
- L'administration nécessite une connexion Supabase Auth **et** une inscription de l'UUID dans `admin_users`.
- Ne publiez jamais la clé `service_role`.

### Limite anti-spam

Le délai de 45 secondes est appliqué par surnom, pas par personne ni par adresse IP. Pour un site privé et humoristique, cela évite les doublons accidentels ; ce n'est pas une protection anti-abus professionnelle. Si le site est partagé largement, ajoutez une vérification CAPTCHA ou une Edge Function avec limitation de débit.

## 6. Vérifications avant de coller la pastille

- Envoyez une note de test.
- Vérifiez qu'elle apparaît dans le classement.
- Ajoutez un commentaire et vérifiez le livre d'or.
- Connectez-vous à `/admin.html`.
- Vérifiez que le tableau de bord affiche le passage.
- Testez la pastille avec un autre téléphone.

## Dépannage

**« Configuration requise »** : vérifiez les deux valeurs dans `config.js`, puis republiez.

**Erreur lors de l'envoi** : vérifiez que `schema.sql` a été exécuté entièrement et que les fonctions RPC existent.

**Connexion admin refusée** : vérifiez l'e-mail et le mot de passe dans Supabase Auth. Vérifiez aussi que le User UID figure dans `public.admin_users`.

**La page s'affiche sans style** : vérifiez que `styles.css` est bien à la racine et que le nom du fichier respecte exactement les minuscules.

**Attention** : le site n'enregistre pas d'informations de santé ou de données médicales. C'est un projet humoristique ; utilisez des surnoms et des commentaires bon enfant.
