# Oblivion Guild Manager

Guild operations web app built with React + Vite + Firestore.

## Local development

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`

## E2E smoke tests

- `npm run test:e2e`

## Firestore indexes deployment

This repo includes `firestore.indexes.json` for optimized notification queries.

When you are ready to publish indexes in your Firebase project:

1. Install Firebase CLI (if not yet installed):
   - `npm i -g firebase-tools`
2. Login:
   - `firebase login`
3. Initialize Firebase in this repo (one-time, if no `firebase.json` yet):
   - `firebase init firestore`
   - Choose your existing project
   - Keep indexes file as `firestore.indexes.json`
4. Deploy indexes:
   - `firebase deploy --only firestore:indexes`
