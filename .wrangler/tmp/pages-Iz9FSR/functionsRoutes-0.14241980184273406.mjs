import { onRequestOptions as __api_spin_progress_js_onRequestOptions } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/api/spin-progress.js"
import { onRequestPost as __api_spin_progress_js_onRequestPost } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/api/spin-progress.js"
import { onRequestOptions as __api_tingli_check_js_onRequestOptions } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/api/tingli-check.js"
import { onRequestPost as __api_tingli_check_js_onRequestPost } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/api/tingli-check.js"
import { onRequest as __api_backup_js_onRequest } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/api/backup.js"
import { onRequest as __vpn_js_onRequest } from "/Users/abramson/Library/Mobile Documents/com~apple~CloudDocs/QClaw Workspace/workspace/crm-lite/deploy/functions/vpn.js"

export const routes = [
    {
      routePath: "/api/spin-progress",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_spin_progress_js_onRequestOptions],
    },
  {
      routePath: "/api/spin-progress",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_spin_progress_js_onRequestPost],
    },
  {
      routePath: "/api/tingli-check",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_tingli_check_js_onRequestOptions],
    },
  {
      routePath: "/api/tingli-check",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_tingli_check_js_onRequestPost],
    },
  {
      routePath: "/api/backup",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_backup_js_onRequest],
    },
  {
      routePath: "/vpn",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__vpn_js_onRequest],
    },
  ]