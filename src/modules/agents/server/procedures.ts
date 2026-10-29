
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  max,
} from "drizzle-orm";

import { db } from "@/db";
import { agents, meetings, agentVersions } from "@/db/schema";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";
import {
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from "@/trpc/init";

import { agentsInsertSchema, agentsUpdateSchema } from "../schema";

const getLatestVersion = async (agentId: string) => {
  const [result] = await db
    .select({
      version: max(agentVersions.version),
    })
    .from(agentVersions)
    .where(eq(agentVersions.agentId, agentId));

  return result?.version ?? null;
};

const ensureIntitalVersion = async ({
  agentId,
  name,
  instructions,
  createdAt,
}: {
  agentId: string;
  name: string;
  instructions: string;
  createdAt?: Date;
}) => {
  const latestVersion = await getLatestVersion(agentId);

  if (latestVersion !== null) {
    return latestVersion;
  }

  await db.insert(agentVersions).values({
    agentId,
    version: 1,
    name,
    instructions,
    ...(createdAt ? { createdAt } : {}),
  });

  return 1;
};

export const agentsRouter = createTRPCRouter({
  update: protectedProcedure
    .input(agentsUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.id),
            eq(agents.userId, ctx.auth.user.id),
          ),
        );

      if (!existingAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      if (
        existingAgent.name === input.name &&
        existingAgent.instructions === input.instructions
      ) {
        return existingAgent;
      }

      const latestVersion = await ensureIntitalVersion({
        agentId: existingAgent.id,
        name: existingAgent.name,
        instructions: existingAgent.instructions,
        createdAt: existingAgent.createdAt,
      });

      const nextVersion = latestVersion + 1;

      const [updatedAgent] = await db
        .update(agents)
        .set({
          name: input.name,
          instructions: input.instructions,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agents.id, input.id),
            eq(agents.userId, ctx.auth.user.id),
          ),
        )
        .returning();

      if (!updatedAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      await db.insert(agentVersions).values({
        agentId: updatedAgent.id,
        version: nextVersion,
        name: updatedAgent.name,
        instructions: updatedAgent.instructions,
      });

      return updatedAgent;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [removedAgent] = await db
        .delete(agents)
        .where(
          and(
            eq(agents.id, input.id),
            eq(agents.userId, ctx.auth.user.id),
          ),
        )
        .returning();

      if (!removedAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      return removedAgent;
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingAgent] = await db
        .select({
          ...getTableColumns(agents),
          meetingCount: db.$count(
            meetings,
            eq(agents.id, meetings.agentId),
          ),
        })
        .from(agents)
        .where(
          and(
            eq(agents.id, input.id),
            eq(agents.userId, ctx.auth.user.id),
          ),
        );

      if (!existingAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      return existingAgent;
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(20).default(5),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.agentId),
            eq(agents.userId, ctx.auth.user.id),
          ),
        );

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      await ensureIntitalVersion({
        agentId: agent.id,
        name: agent.name,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      });

      const items = await db
        .select({
          ...getTableColumns(agentVersions),
        })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, input.agentId))
        .orderBy(desc(agentVersions.version))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const [totalResult] = await db
        .select({
          count: count(),
        })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, input.agentId));

      const latestVersion = await getLatestVersion(input.agentId);
      const total = totalResult?.count ?? 0;

      return {
        items: items.map((version) => ({
          ...version,
          isCurrent: version.version === latestVersion,
        })),
        total,
        totalPages: Math.ceil(total / input.pageSize),
        currentVersion: latestVersion,
      };
    }),

  restore: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        version: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.agentId),
            eq(agents.userId, ctx.auth.user.id),
          ),
        );

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      const [selectedVersion] = await db
        .select()
        .from(agentVersions)
        .where(
          and(
            eq(agentVersions.agentId, input.agentId),
            eq(agentVersions.version, input.version),
          ),
        );

      if (!selectedVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent version not found",
        });
      }

      const latestVersion = await ensureIntitalVersion({
        agentId: agent.id,
        name: agent.name,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      });

      if (selectedVersion.version === latestVersion) {
        return agent;
      }

      const [restoredAgent] = await db
        .update(agents)
        .set({
          name: selectedVersion.name,
          instructions: selectedVersion.instructions,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agents.id, input.agentId),
            eq(agents.userId, ctx.auth.user.id),
          ),
        )
        .returning();

      if (!restoredAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      const nextVersion = latestVersion + 1;

      await db.insert(agentVersions).values({
        agentId: restoredAgent.id,
        version: nextVersion,
        name: restoredAgent.name,
        instructions: restoredAgent.instructions,
      });

      return restoredAgent;
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .int()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize } = input;

      const where = and(
        eq(agents.userId, ctx.auth.user.id),
        search ? ilike(agents.name, `%${search}%`) : undefined,
      );

      const data = await db
        .select({
          ...getTableColumns(agents),
          meetingCount: db.$count(
            meetings,
            eq(agents.id, meetings.agentId),
          ),
        })
        .from(agents)
        .where(where)
        .orderBy(desc(agents.createdAt), desc(agents.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db
        .select({
          count: count(),
        })
        .from(agents)
        .where(where);

      const totalPages = Math.ceil(total.count / pageSize);

      return {
        items: data,
        total: total.count,
        totalPages,
      };
    }),

  create: premiumProcedure("agents")
    .input(agentsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [createdAgent] = await db
        .insert(agents)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();

      await db.insert(agentVersions).values({
        agentId: createdAgent.id,
        version: 1,
        name: createdAgent.name,
        instructions: createdAgent.instructions,
      });

      return createdAgent;
    }),
});
