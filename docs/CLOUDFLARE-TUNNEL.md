# Pantry Cloudflare Tunnel

## Live deployment

Public address: https://pantry.casciottiprojects.com

- Account: `5921c09fa01d24c2a1c152cf1bb2f3f2`
- Zone: `335a1fe25f65feff32785d7a8fc52764` (`casciottiprojects.com`, active)
- Tunnel: `pantry-food-webapp`
- Tunnel ID: `3e8e1561-cf85-4e5a-af29-6dd2254f7a34`
- DNS record ID: `0e0f836718cbcc16f21417f0fea33efb`
- DNS: proxied CNAME `pantry.casciottiprojects.com` → `3e8e1561-cf85-4e5a-af29-6dd2254f7a34.cfargotunnel.com`
- Origin: `http://frontend:80`, inside the existing Compose network
- Container: `food-web-app-cloudflared-1`
- Restart policy: `unless-stopped`

The owner's fresh authorization resolved the zone/DNS/tunnel access blocker. Direct zone lookup, DNS access and tunnel access all succeeded. The earlier small OAuth `scope` string alone was not a complete description of the provider-side grant; the successful resource operations are the verification. No further account changes are required.

The owner explicitly approved public access without login, including edit/delete access. No Cloudflare Access restriction was added. This remains an unauthenticated local-development application exposed through a public hostname; anyone who reaches it can use its data-changing features.

## Configuration

The Compose `cloudflared` service is opt-in through the `tunnel` profile and runs a verified/pinned image. Its remotely managed configuration is:

```json
{
  "config": {
    "ingress": [
      {"hostname": "pantry.casciottiprojects.com", "service": "http://frontend:80"},
      {"service": "http_status:404"}
    ]
  }
}
```

The fallback is an explicit 404; no other hostname is routed by this tunnel. Existing tunnels and other project DNS records were not modified.

The frontend proxies the API and uploaded files. No new host ports are published by the connector. Port 2000 is an internal metrics/readiness endpoint only.

The connector token is stored in the project's gitignored `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, with mode `0600`. Docker administrators can inspect container environment variables, so Docker daemon access remains a trusted boundary. Do not print expanded Compose configuration or the `.env` file, or put tokens in Git, screenshots or chat.

## Operations

From `/opt/data/home/food-webapp-project`:

```sh
# Start/recreate the full app with its public tunnel
docker compose -p food-web-app --profile tunnel up -d

# Start/recreate only the connector
docker compose -p food-web-app --profile tunnel up -d --no-deps cloudflared

# Stop public tunnel connectivity while leaving the local app running
docker compose -p food-web-app --profile tunnel stop cloudflared

# Validate without printing expanded credentials
docker compose -p food-web-app --profile tunnel config --quiet

# Check connector status/logs; do not enable debug request logging
docker compose -p food-web-app --profile tunnel ps cloudflared
docker logs --tail 30 food-web-app-cloudflared-1
```

Normal Compose startup without `--profile tunnel` does not start an absent/stopped profiled connector. An already-running connector is not stopped by omitting the profile. Docker restart policy restarts the running connector after daemon/host restarts unless it was explicitly stopped.

### Connector-token retrieval helper

`scripts/provision_cloudflare_token.py` retrieves only this tunnel's connector token using the existing authenticated native Cloudflare MCP connection. It validates the account/tunnel claims, atomically updates `.env` while preserving other settings, verifies persistence without printing the value, and does not edit global Hermes configuration.

```sh
PYTHONPATH=/opt/hermes /opt/hermes/.venv/bin/python scripts/provision_cloudflare_token.py
```

Run as the normal Hermes user, not root. Retrieval is for this already-created tunnel; it does not create or rotate tunnels or DNS records. Recreate the connector after changing its token environment.

## Verification

Verified October 20, 2026 UTC:

- Tunnel creation and exact ingress configuration were read back through Cloudflare MCP.
- The exact proxied CNAME was read back through Cloudflare MCP.
- Cloudflare reports the tunnel healthy, with four active connections.
- Internal `/ready` returned HTTP 200 and `readyConnections: 4`.
- Connector status is running with restart count zero.
- Cloudflare and Google public DNS resolvers both returned the hostname's proxied addresses. An initial negative result from the container's system resolver cleared; actual browser navigation then succeeded.
- Chrome MCP loaded the public HTTPS hostname in an isolated browser context, with `isSecureContext: true`.
- Public `/`, `/lists.html`, `/photos.html`, `/health`, `/recipes`, `/grocery-lists`, and `/photos` returned HTTP 200 with the expected HTML/JSON types. `/health` reported a connected database.
- Complete public-hostname browser workflows passed **31 desktop + 31 mobile = 62 assertions**, with zero uncaught JavaScript errors. Counts include repeated checks, not 62 independent features.
- Workflows exercised recipe creation/edit/delete, nutrition save, grocery list/item CRUD and check-off, bulk ingredients, photo upload/caption/link/unlink/delete, cooking progress/reload/reset, navigation, and error/retry recovery.
- Public latency exposed a nutrition-editor race: a late background detail response could clear user-entered values. A deliberately delayed-response regression failed before the fix and passed after. The frontend was rebuilt; editor opening now waits for its data, and late responses cannot overwrite an open form.
- Browser harness readiness was tightened to wait for the grocery-list page's handler before its first click. This is a test synchronization change, not a claim that a hidden modal was an application failure.
- `git diff --check`, JavaScript syntax validation, and secret-file ignore/permission checks passed.

Evidence: `docs/evidence/pantry-public/` contains the final desktop/mobile JSON, screenshot fixtures, browser output and final container/readiness checks. Earlier failed attempts are retained as debugging evidence; `browser-checks-fixed.txt` and the final JSON are the successful runs. Screenshots use synthetic recipe/image fixtures. Only QA-owned records were created and removed during the workflow checks.

Some non-browser HTTP requests received Cloudflare 403 responses while real Chrome navigation and browser-origin API operations passed; no existing zone-wide security settings were weakened to bypass those responses. Programmatic clients may need separate investigation if they are intended consumers.

No commits or GitHub pushes were performed.
