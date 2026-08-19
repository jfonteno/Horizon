# Horizon bot profiles

Bot personalities live in `bots/profiles` and are discovered when Horizon starts.
Adding another valid JSON profile does not require editing the game engine. Restart
Horizon after adding a profile so the local build can discover it.

Profiles control priorities, search breadth, risk tolerance, resource reserves,
Technology preferences, and strategic behaviors. They cannot read concealed game
state or change rules. Entirely new algorithms still belong in `game/ai`.

Every profile must match `bots/schemas/bot-profile.schema.json`, use a unique ID,
and declare `profileVersion: 1`.
