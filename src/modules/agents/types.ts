import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

export type AgentGetOne = inferRouterOutputs<AppRouter>["agents"]["getOne"];
export type AgentGetMany =
  inferRouterOutputs<AppRouter>["agents"]["getMany"]["items"][number];

export type agentVersion = 
inferRouterOutputs<AppRouter>["agents"]["getHistory"]["items"][number];
