# Horizon 0.21.1

Fixes the opening Hidden Objective screen introduced by the 0.21.0 archive display. The required-choice overlay previously displayed only the first Legacy section. Adding the archive made it hide the actual draw and selection controls.

The overlay now identifies the Hidden selection section explicitly. Players can draw their three objectives and choose one at the beginning of the game and each subsequent Era. The full Legacy page retains its archive, scoring details, and other objectives.

No room reset or data migration is needed. Stop the server, extract this release into a new folder, copy your existing data directory, and run Start-Horizon-Windows.cmd. Reload browser clients after restarting. Cloudflare routing stays unchanged.

Validation: production build, lint, type checking, and focused room/objective tests. Visual browser verification remains unavailable in this workspace.
