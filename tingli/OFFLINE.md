# Offline release contract

- The HTML shell is pinned to the active service-worker release and opens cache-first. Network checks must not block a saved app entry.
- `tingli-media-v1` is durable across releases. Do not delete it while updating the shell.
- Old `tingli-cache-*` media are migrated; failed copies keep the original cache. A previous shell is retained as a fallback.
- The versioned offline manifest is a mandatory installation dependency. Status and flight verification read the cached manifest, never rebuild the list from a network request.
- All data-declared `audio` and `image` files must appear in that manifest. Stage modified media first; `python scripts/tingli_offline_manifest.py` prints a regenerated manifest. `--check` validates it without changing files.
- When changing release version, update `APP_VER`, `SW_BUILD`, worker `VERSION`, the manifest filename and its CORE entry together. Retain the existing immutable helper filename unless changing its program logic.
- Successful downloads are committed one file at a time. Retry exact missing or outdated files. Message lifetime is protected by `event.waitUntil`; progress renews the UI inactivity timeout.
- An unknown manifest, storage error or failed download must never be reported as offline-ready.
- Offline changes must not alter synchronization, localStorage records, IndexedDB recordings, icon artwork, course data or push behavior.

Validation: `node --test tests/sync/*.test.cjs tests/sync-check.test.cjs`, `python tests/sync/check-syntax.py`, `python scripts/tingli_offline_manifest.py --check`.
