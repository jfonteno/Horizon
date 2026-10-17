# Horizon 0.21.2

Targeted Windows room-save reliability patch. Includes all 0.21.1 changes, including the opening Hidden Objective selection fix.

## Changes

- Atomic save replacement retries Windows EPERM, EACCES, and EBUSY errors with bounded backoff: up to ten attempts over approximately 4.6 seconds of waiting.
- Only the rename is retried. The room command and Turn resolution are not replayed by the save retry.
- Room reads share the per-room write queue, avoiding Horizon polling reads overlapping an in-flight replacement in the supported single server process.
- If replacement still fails, the existing committed save is left intact and the client receives a clearer error. The server never deletes the committed file to force a replacement.
- Unrelated storage errors fail immediately. Persistent permission errors or locks still require addressing the underlying cause.

## Upgrade and resume

1. Stop Horizon using Ctrl+C in its server window. Ensure only one Horizon instance will use this data folder.
2. Back up the entire old data folder before replacing any application files.
3. Extract 0.21.2 into a new folder and copy the old data folder into it.
4. Run Start-Horizon-Windows.cmd, reload the browser, and resume the existing room. No new room or Cloudflare changes are required.
5. Check the current Turn and Order status before retrying progression. If the previous save failed, its uncommitted changes may need to be submitted again.

Do not manually replace a room JSON file with a temporary file: an uncommitted temporary file may be stale. If failures persist, check for duplicate Horizon processes, programs accessing the save folder, and folder permissions. Running as Administrator or disabling security software is not required by this patch.

## Validation

Production build, lint, type checking, and targeted persistence, room command, timer, and production static-asset tests. Fault-injection tests exercise temporary Windows errors, retry exhaustion, unchanged committed bytes after failure, a successful subsequent retry, and concurrent polling. These simulate Windows error codes on Linux; the exact lock on the reported Windows host has not been reproduced.
