import type { ApiErrorResponse } from '@wingtechbot-mk3/types/api/v1/common';
import {
  validateCreateGuildRequest,
  validateGuildParams,
  validateUpdateGuildRequest,
} from '@wingtechbot-mk3/types/api/v1/guilds';
import type { Request, RequestHandler, Response } from 'express';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import { GuildNotFoundError } from '../../../../core/errors/GuildErrors.js';
import {
  createGuild,
  deleteGuild,
  getAllGuilds,
  getGuildById,
  updateGuild,
} from '../../../../core/services/GuildService.js';
import type { DB } from '../../../../generated/database/types.js';
import { GuildPresenter } from '../presenters/GuildPresenter.js';

/**
 * HTTP input adapters for Guild operations
 * These controllers handle HTTP requests and delegate to domain services
 */

const handleError = (error: unknown, res: Response): void => {
  if (error instanceof GuildNotFoundError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: error.message,
    };
    res.status(404).json(errorResponse);
    return;
  }

  if (error instanceof z.ZodError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: 'Validation failed',
      details: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (error instanceof Error) {
    if (error.message.includes('already exists')) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: error.message,
      };
      res.status(409).json(errorResponse);
      return;
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: error.message,
    };
    res.status(400).json(errorResponse);
    return;
  }

  console.error('Unexpected error:', error);
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: 'Internal server error',
  };
  res.status(500).json(errorResponse);
};

export const getGuildsV1Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const guilds = await getAllGuilds(db);
      const apiGuilds = GuildPresenter.toApiV1List(guilds);
      res.json({
        success: true,
        data: apiGuilds,
      });
    } catch (error) {
      handleError(error, res);
    }
  };

export const getGuildByIdV1Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const params = validateGuildParams(req.params);
      const guild = await getGuildById(db, params.id);
      const apiGuild = GuildPresenter.toApiV1(guild);
      res.json({
        success: true,
        data: apiGuild,
      });
    } catch (error) {
      handleError(error, res);
    }
  };

export const createGuildV1Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestData = validateCreateGuildRequest(req.body);

      // Transform API request to domain entity format
      const guildData = {
        id: requestData.id,
        name: requestData.name,
        ownerId: requestData.ownerId,
        memberCount: requestData.memberCount ?? 0,
        prefix: requestData.prefix ?? '!',
        isActive: true,
      };

      const guild = await createGuild(db, guildData);
      const apiGuild = GuildPresenter.toApiV1(guild);
      res.status(201).json({
        success: true,
        data: apiGuild,
      });
    } catch (error) {
      handleError(error, res);
    }
  };

export const updateGuildV1Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const params = validateGuildParams(req.params);
      const updateData = validateUpdateGuildRequest(req.body);

      if (Object.keys(updateData).length === 0) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'Update data is required',
        };
        res.status(400).json(errorResponse);
        return;
      }

      const guild = await updateGuild(db, params.id, updateData);
      const apiGuild = GuildPresenter.toApiV1(guild);
      res.json({
        success: true,
        data: apiGuild,
      });
    } catch (error) {
      handleError(error, res);
    }
  };

export const deleteGuildV1Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const params = validateGuildParams(req.params);
      await deleteGuild(db, params.id);
      res.json({
        success: true,
        message: 'Guild deleted successfully',
      });
    } catch (error) {
      handleError(error, res);
    }
  };
