# WeWeRSS Production Deployment

## Topology

WeWeRSS runs as a sidecar service on the same ECS host as the Next.js app. The app must use the Docker Compose service name for backend calls and a browser-reachable reverse-proxy URL for frontend navigation.

## Required Environment

```env
WEWERSS_BASE_URL=http://wewerss:4000
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss
WEWERSS_SQLITE_PATH=/app/wewe-rss/data/wewe-rss.db
```

`WEWERSS_BASE_URL` is only for server-side calls inside the Docker network. `NEXT_PUBLIC_WEWERSS_PUBLIC_URL` is what users open in the browser.

## Production Rule

Production must not silently fall back to `http://localhost:4000`. If `WEWERSS_BASE_URL` is missing, WeWeRSS APIs return:

```json
{
  "success": false,
  "code": "WEWERSS_CONFIG_MISSING",
  "message": "未配置 WeWeRSS 服务地址"
}
```

## Reverse Proxy

Until a domain is available, expose WeWeRSS through:

```txt
http://47.119.182.210/wewerss
```

When a domain is added, update only `NEXT_PUBLIC_WEWERSS_PUBLIC_URL`; keep backend traffic on `http://wewerss:4000`.
