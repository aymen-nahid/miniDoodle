# mini-doodle (créneaux)

Application web très simple (type Doodle) avec un lien public, saisie du nom/prénom, et votes persistants (Supabase Postgres – gratuit).

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000

## Prérequis Supabase (gratuit)

1) Créer un projet Supabase.
2) Dans le SQL editor, exécuter:

```sql
create table if not exists public.votes (
  person_name text not null,
  slot_id text not null,
  vote boolean not null,
  updated_at timestamptz not null default now(),
  primary key (person_name, slot_id)
);
```

3) Désactiver le RLS pour simplifier (comme l’app est “accès libre”) ou créer des policies adaptées.

## Variables d’environnement

- `PORT` (défaut: 3000)
- `SUPABASE_URL` (Settings → API)
- `SUPABASE_SERVICE_ROLE_KEY` (Settings → API) — à garder secret, côté serveur uniquement

## Hébergement gratuit (ex: Render)

- Type: “Web Service”
- Build command: `npm install`
- Start command: `npm start`
- Ajouter les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`

## Adapter les créneaux

Modifier `server/lib/slots.js`.
