<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Provider keys/settings resolve from `public.provider_credentials` (server-only table, loaded per request with a 1-minute cache into the `readEnv` overlay) before env variables — keeps the app host-agnostic while env vars remain a fallback.
