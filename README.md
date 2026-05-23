# MegaETH Mentions

A small shareable web app for checking how many times an X account mentioned MegaETH in the last 12 months.

## Local

```sh
vercel dev
```

## Environment

Set this in `.env.local` and Vercel:

```txt
TWITTER_API_TOKEN=
```

## Deploy

Import this folder into Vercel, add `TWITTER_API_TOKEN`, and deploy.

The Vercel project is connected to GitHub. Pushes to `main` should deploy production once the GitHub integration is active for the repo.
