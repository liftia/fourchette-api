# fourchette-api

L'API de Fourchette & Cie, l'application d'un restaurant fictif : la carte, les tables, les commandes, les envois en cuisine, l'addition. Elle sert la caisse (`fourchette-pos`) et l'écran cuisine (`fourchette-kitchen`). Toutes les données sont fictives.

Hono, `node:sqlite` en mémoire, TypeScript exécuté directement par Node, tests avec `node:test`.

## Prérequis

- Node 24.15 ou plus, et git.
- Un compte GitHub. La CLI `gh` est conseillée, pas obligatoire.

## Installer les trois dépôts

Forkez les trois dépôts sur votre compte, puis clonez vos forks côte à côte dans un même dossier `fourchette/`. Votre fork est `origin` ; le dépôt de départ est `upstream`.

Avec `gh` :

```
mkdir fourchette
cd fourchette
gh repo fork liftia/fourchette-api --clone
gh repo fork liftia/fourchette-pos --clone
gh repo fork liftia/fourchette-kitchen --clone
```

`gh` choisit `upstream` comme dépôt par défaut : pour que vos PR restent dans votre fork, lancez dans chacun des trois dossiers `gh repo set-default <votre-compte>/<dépôt>`.

Sans `gh` : forkez sur github.com, puis pour chaque dépôt

```
git clone https://github.com/<votre-compte>/fourchette-api.git
cd fourchette-api
git remote add upstream https://github.com/liftia/fourchette-api.git
```

## Vérifier le poste

Dans `fourchette-api` :

```
npm run preflight
```

Il contrôle Node et git, trouve les deux autres dépôts, joint `upstream`, installe les trois (`npm ci`), lance leurs contrôles, démarre les trois applications et les arrête. Une ligne par contrôle ; tout doit être ✔.

## Lancer

```
npm run all
```

Lance l'API et les deux fronts ; Ctrl+C arrête les trois.

| Application | Adresse |
|---|---|
| API | http://localhost:3000 |
| Caisse | http://localhost:5174 |
| Cuisine | http://localhost:5173 |

Seule, l'API se lance par `npm start` (ou `npm run dev`, qui redémarre à chaque modification). `DATA=empty npm start` démarre avec la carte seule (PowerShell : `$env:DATA='empty'; npm start`). La base est en mémoire : redémarrer l'API remet le même service.

## Vérifier son travail

```
npm run verify
```

Contrôle des types (`tsc --noEmit`), puis les tests. « Terminé » veut dire `verify` vert.

## Branches

D'autres branches de départ arrivent sur `upstream` en séance, quand on en a besoin. Récupérez-la, puis poussez-la sur votre fork : vos PR pourront la prendre pour base.

```
git fetch upstream
git switch -c <branche> upstream/<branche>
git push -u origin <branche>
```

Travaillez sur une branche `feature/<nom>` partie de la branche de départ, dans chaque dépôt que vous touchez. Poussez-la sur votre fork et ouvrez la PR dans votre fork, vers la branche de départ :

```
git switch -c feature/<nom>
git push -u origin feature/<nom>
gh pr create --base <branche>
```

## Le filet automatique

Un filet de cas automatiques arrive sur `upstream` au moment du débrief. Il se récupère dans un dossier `acceptance/`, ignoré par git :

```
npm run acceptance:fetch -- <filet>
npm run acceptance -- <filet>
```

Il lance votre API sur un port libre, joue une histoire par ses routes et affiche une ligne par cas.
