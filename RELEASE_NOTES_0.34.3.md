# Horizon 0.34.3: Foundry Currency route

Foundry bots with no recurring Currency production now rank Currency trade and a Trade Agreement as opening priorities. They prefer partners whose public faction identity or visible production suggests Currency supply, and propose Currency trades before other resource exchanges. When no Currency specialist is present, exploration receives a contact seeking bonus and diplomacy attempts a route with an available partner. Once Foundry establishes independent Currency production, the emergency priority subsides.

This is a targeted behavior update. In a four player Medium bot match with Meridian, Foundry obtained an opening Trade Agreement and a Currency trade but still ended with no Currency income and a large Material stockpile. The underlying follow through problem remains: bots need to reserve and acquire enough Currency to build an independent Center, coordinate explorer and Colony Ship routes, and replan after a partner runs dry. The five game Medium sample also showed Foundry averaging 5.8 LP and 0.8 Gate Tributes; it is too small to establish an overall balance trend.

Validation: typecheck and 10 AI tests passed, including the opening specialist and fallback contact scenarios. Save format and game rules are unchanged.
