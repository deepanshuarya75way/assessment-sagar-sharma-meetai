
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { toast } from "sonner";

import {
  CheckIcon,
  HistoryIcon,
  RotateCcwIcon,
} from "lucide-react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { useConfirm } from "@/hooks/use-confirm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DataPagination } from "@/components/data-pagination";

import { DEFAULT_HISTORY_PAGE_SIZE } from "@/constants";

import type { agentVersion } from "../../types";

interface Props {
  agentId: string;
  currentName: string;
  currentInstructions: string;
}

type DiffLine = {
  type: "same" | "removed" | "added";
  text: string;
};

const buildLineDiff = (
  selectedText: string,
  currentText: string,
): DiffLine[] => {
  const selectedLines =
    selectedText.split("\n");

  const currentLines =
    currentText.split("\n");

  const dp = Array.from(
    {
      length:
        selectedLines.length + 1,
    },
    () =>
      Array(
        currentLines.length + 1,
      ).fill(0),
  );

  for (
    let i =
      selectedLines.length - 1;
    i >= 0;
    i--
  ) {
    for (
      let j =
        currentLines.length - 1;
      j >= 0;
      j--
    ) {
      dp[i][j] =
        selectedLines[i] ===
        currentLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(
              dp[i + 1][j],
              dp[i][j + 1],
            );
    }
  }

  const result: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (
    i < selectedLines.length &&
    j < currentLines.length
  ) {
    if (
      selectedLines[i] ===
      currentLines[j]
    ) {
      result.push({
        type: "same",
        text: selectedLines[i],
      });

      i++;
      j++;
    } else if (
      dp[i + 1][j] >=
      dp[i][j + 1]
    ) {
      result.push({
        type: "removed",
        text: selectedLines[i],
      });

      i++;
    } else {
      result.push({
        type: "added",
        text: currentLines[j],
      });

      j++;
    }
  }

  while (
    i < selectedLines.length
  ) {
    result.push({
      type: "removed",
      text: selectedLines[i],
    });

    i++;
  }

  while (
    j < currentLines.length
  ) {
    result.push({
      type: "added",
      text: currentLines[j],
    });

    j++;
  }

  return result;
};

const formatDate = (
  value: agentVersion["createdAt"],
) =>
  new Date(value).toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );

export const AgentHistory = ({
  agentId,
  currentName,
  currentInstructions,
}: Props) => {
  const trpc = useTRPC();

  const queryClient =
    useQueryClient();

  const [page, setPage] =
    useState(1);

  const [
    selectedVersionNumber,
    setSelectedVersionNumber,
  ] = useState<number | null>(
    null,
  );

  const { data, isLoading } =
    useQuery(
      trpc.agents.getHistory.queryOptions(
        {
          agentId,
          page,
          pageSize:
            DEFAULT_HISTORY_PAGE_SIZE,
        },
      ),
    );

  const [
    RestoreConfirmation,
    confirmRestore,
  ] = useConfirm(
    "Restore this version?",
    "The current agent state will be preserved and the selected version will become a new version.",
  );

  const restoreAgent =
    useMutation(
      trpc.agents.restore.mutationOptions(
        {
          onSuccess:
            async () => {
              await queryClient.invalidateQueries(
                trpc.agents.getOne.queryOptions(
                  {
                    id: agentId,
                  },
                ),
              );

              await queryClient.invalidateQueries(
                trpc.agents.getHistory.queryOptions(
                  {
                    agentId,
                    page,
                    pageSize:
                      DEFAULT_HISTORY_PAGE_SIZE,
                  },
                ),
              );

              toast.success(
                "Agent restored successfully",
              );
            },

          onError: (error) => {
            toast.error(
              error.message,
            );
          },
        },
      ),
    );

  useEffect(() => {
    if (!data?.items.length) {
      setSelectedVersionNumber(
        null,
      );
      return;
    }

    const exists =
      data.items.some(
        (item) =>
          item.version ===
          selectedVersionNumber,
      );

    if (!exists) {
      setSelectedVersionNumber(
        data.items[0].version,
      );
    }
  }, [
    data?.items,
    selectedVersionNumber,
  ]);

  const selectedVersion =
    useMemo(
      () =>
        data?.items.find(
          (item) =>
            item.version ===
            selectedVersionNumber,
        ) ??
        data?.items[0] ??
        null,
      [
        data?.items,
        selectedVersionNumber,
      ],
    );

  const diff = useMemo(
    () =>
      selectedVersion
        ? buildLineDiff(
            selectedVersion.instructions,
            currentInstructions,
          )
        : [],
    [
      selectedVersion,
      currentInstructions,
    ],
  );

  const handleRestore =
    async () => {
      if (
        !selectedVersion ||
        selectedVersion.isCurrent
      ) {
        return;
      }

      const confirmed =
        await confirmRestore();

      if (!confirmed) {
        return;
      }

      await restoreAgent.mutateAsync(
        {
          agentId,
          version:
            selectedVersion.version,
        },
      );
    };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            History
          </CardTitle>
        </CardHeader>

        <CardContent>
          Loading history...
        </CardContent>
      </Card>
    );
  }

  if (!data?.items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="size-5" />
            History
          </CardTitle>
        </CardHeader>

        <CardContent>
          No versions yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <RestoreConfirmation />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="size-5" />
            History
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* VERSION LIST */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Versions
              </p>

              {data.items.map(
                (version) => (
                  <button
                    key={
                      version.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedVersionNumber(
                        version.version,
                      )
                    }
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedVersion?.version ===
                      version.version
                        ? "border-primary bg-accent"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Version{" "}
                        {
                          version.version
                        }
                      </span>

                      {version.isCurrent && (
                        <Badge variant="secondary">
                          <CheckIcon />
                          Current
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(
                        version.createdAt,
                      )}
                    </p>

                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {
                        version.name
                      }
                    </p>
                  </button>
                ),
              )}
            </div>

            {/* SELECTED VERSION */}
            {selectedVersion && (
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        Version{" "}
                        {
                          selectedVersion.version
                        }
                      </h3>

                      {selectedVersion.isCurrent && (
                        <Badge variant="secondary">
                          Current
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {formatDate(
                        selectedVersion.createdAt,
                      )}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      selectedVersion.isCurrent ||
                      restoreAgent.isPending
                    }
                    onClick={
                      handleRestore
                    }
                  >
                    <RotateCcwIcon />

                    Restore
                  </Button>
                </div>

                {/* NAME */}
                <div>
                  <p className="text-sm font-medium">
                    Name
                  </p>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border bg-red-50 p-3 text-sm">
                      <span className="mb-1 block text-xs font-medium">
                        Selected version
                      </span>

                      {
                        selectedVersion.name
                      }
                    </div>

                    <div className="rounded-md border bg-green-50 p-3 text-sm">
                      <span className="mb-1 block text-xs font-medium">
                        Current
                      </span>

                      {currentName}
                    </div>
                  </div>
                </div>

                {/* INSTRUCTIONS DIFF */}
                <div>
                  <p className="text-sm font-medium">
                    Instructions
                  </p>

                  <div className="mt-2 overflow-hidden rounded-md border font-mono text-sm">
                    {diff.map(
                      (
                        line,
                        index,
                      ) => (
                        <div
                          key={`${line.type}-${index}`}
                          className={`flex min-h-7 border-b px-3 py-1 last:border-b-0 ${
                            line.type ===
                            "removed"
                              ? "bg-red-50"
                              : line.type ===
                                  "added"
                                ? "bg-green-50"
                                : ""
                          }`}
                        >
                          <span className="mr-3 w-5 shrink-0 select-none">
                            {line.type ===
                            "removed"
                              ? "-"
                              : line.type ===
                                  "added"
                                ? "+"
                                : " "}
                          </span>

                          <span className="whitespace-pre-wrap break-words">
                            {line.text ||
                              " "}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DataPagination
            page={page}
            totalPages={
              data.totalPages
            }
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </>
  );
};
