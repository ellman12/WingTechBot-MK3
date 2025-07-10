import type { Guild as ApiGuild } from '@wingtechbot-mk3/types/api/v1/guilds';
import type { Guild as DomainGuild } from '@wingtechbot-mk3/types/entities/guild';

/**
 * GuildPresenter transforms domain Guild entities to API v1 representations
 * This is the output adapter in hexagonal architecture
 */
export class GuildPresenter {
  /**
   * Transform domain Guild entity to API v1 representation
   */
  static toApiV1(guild: DomainGuild): ApiGuild {
    return {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      prefix: guild.prefix,
      isActive: guild.isActive,
      createdAt: guild.createdAt.toISOString(),
      updatedAt: guild.updatedAt.toISOString(),
    };
  }

  /**
   * Transform multiple domain Guild entities to API v1 representations
   */
  static toApiV1List(guilds: readonly DomainGuild[]): readonly ApiGuild[] {
    return guilds.map(guild => this.toApiV1(guild));
  }
}
