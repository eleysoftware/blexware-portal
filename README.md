# BLEXware Portal

BLEXware Website: Take the two specification PDFs to build a responsive website/web app. 1) BLEXware.com Website Functional Specification.pdf 2) BLEXware.com Security & Compliance Specification.pdf. Add these specifications to the Project Knowledge.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/464d1e70-9d8e-4191-938a-125ef3036961).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

A Hyperswitch API key was committed historically. Rotate that key in the Hyperswitch dashboard, then store the new value only in the gitignored `.env` file as `HYPERSWITCH_API_KEY`.

## Environment configuration

All configuration is read through the centralised modules in `src/config/`
(`environment`, `database`, `payments`, `ai`, `email`, `storage`). Application
code uses `config.payments.apiUrl`, `config.database.supabaseUrl`, and so on —
never `process.env` directly (only `src/config/env.ts` touches the environment).

| Environment | Source of values |
| --- | --- |
| Local | `.env.local` |
| Test | `.env.test` |
| Development | `.env.development` |
| Staging | deployment environment secrets |
| Production | hosting platform secret manager |

`.env.example` documents every variable; real values never enter Git. Browser
visible variables must be prefixed `VITE_` (this is Vite, not Next.js); secrets
stay unprefixed and are only read inside server handlers.

To add a variable: add it to `.env.example`, expose it from the matching module
in `src/config/`, then consume it as `config.<area>.<value>`.

### AI generation outside Lovable

Inside Lovable, `LOVABLE_API_KEY` is injected automatically, so the AI actions
("Generate draft", "Regenerate", "Regenerate proposal") just work. Locally
nothing injects it — set your own key in `.env.local`:

```
AI_API_KEY=<your key>
# optional: use any OpenAI-compatible provider instead of the Lovable gateway
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
```

The Lovable-managed gateway key is never revealed for copying, so a local run
needs a key you control (a Lovable AI Gateway key from your account, or any
OpenAI-compatible provider key). Without it, the AI buttons are disabled with
an inline note; every other admin action still works.

## Run Tests - Unit, Integraton, and E2E

```sh
npm run test:unit
npm run test:integration
npm run test:e2e
```