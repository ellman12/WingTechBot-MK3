import { routeSetupService } from "@application/services/RouteSetupService.js";
import type { Application } from "express";
import type { Kysely } from "kysely";
import type { DB } from "kysely-codegen";

// Public interface - exported functions
export const initializeApiRouter = (app: Application, db: Kysely<DB>): void => {
    routeSetupService.initialize(app, db);
};

export const setupRoutes = (): void => {
    routeSetupService.setupAllRoutes();
};
