import { providerConfiguration } from "../../../../game/server/providers";
import { getOperationsSettingsRepository } from "../../../../game/server/runtime";

export async function GET(){const access=await getOperationsSettingsRepository().get();return Response.json({providers:providerConfiguration(),multiplayerAccess:{verificationMode:access.multiplayerVerification,roomCreationOpen:access.roomCreationOpen,spectatorsAllowed:access.spectatorsAllowed,notice:access.notice}},{headers:{"cache-control":"no-store"}});}
