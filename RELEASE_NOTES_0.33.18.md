# Horizon 0.33.18

This patch fixes the Windows build failure from a downloaded folder such as `Horizon_Shattered_Reach_Playtest_0.33.17 (1)`.

The build runner now invokes Vinext, TypeScript, and ESLint through Node without a command shell. The alternate local build launcher uses the same direct process approach. This avoids Windows interpreting part of an extracted folder name as a command.

All 0.33.17 My Games features remain included. No room or Commander data migration is required.

## Install

Back up the existing `data/` directory. Extract this patch to a new folder, then keep the previous `data/` directory and any local `horizon-auth.env` configuration when replacing the application files. Run `Start-Horizon-Windows.cmd` from the new folder. The launcher will build 0.33.18 before starting the server.

## Verification

The standalone build completed. A regression test launched the build runner from a folder with spaces and parentheses, and the self-hosted server asset test passed after the build.
