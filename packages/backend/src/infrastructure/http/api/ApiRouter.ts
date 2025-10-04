import type { DB } from "@db/types.js";
import type { Application } from "express";
import type { Kysely } from "kysely";

import { routeSetupService } from "../RouteSetupService.js";

export const initializeApiRouter = (app: Application, db: Kysely<DB>): void => {
    routeSetupService.initialize(app, db);
};

export const setupRoutes = (): void => {
    routeSetupService.setupAllRoutes();
};
