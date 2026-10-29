// "use client"; 
// import { 
//   useEffect,
//   useMemo,
//   useState,
// } from "react";


// import { toast } from "sonner";

// import {
//  CheckIcon, 
//  HistoryIcon, 
//   RotateCcwIcon, 
// } from "lucide-react";

// import { 
//   useMutation ,
//   useQuery,
//   useQueryClient,
// } from "@tanstack/react-query";

// import { useTRPC } from "@/trpc/client";

// import { useConfirm } from "@/hooks/use-confirm";
// import { Badge } from "@/components/ui/badge";
// import { 
//   Card, 
//   CardContent,
//   CardHeader, 
//   CardTitle,
// } from "@/components/ui/card"

// import { DataPagination } from "@/components/data-pagination";

// import { DEFAULT_HISTORY_PAGE_SIZE } from "@/constants";
// import { agentVersion } from "../../types";
// import { getCurrentAdapter } from "better-auth";
// import { resourceLimits } from "worker_threads";
 
// interface Props { 
//   agentId : string; 
//   currentName : string; 
//   currentInstructions : string,
// }
// type DiffLine = { 
//   type : "same" | "removed" | "added";
//   text : string;
// };

// const buildLineDiff =  ( 
//   selectedText :  string, 
//   currentText :  string,
// ): DiffLine[] => { 
//   const selectedLines = selectedText.split("\n");
//   const currentLines = currentText.split("\n");
  
//   const dp = Array.from(
//     { 
//       length : selectedLines.length + 1,
//     },
//     () => 
//       Array(
//         currentLines.length + 1,
//       ).fill(0),
//   ); 
//   for( 
//     let i = selectedLines.length - 1;
//     i >= 0; 
//     i--
//   ) { 
//     for (
//        let j = 
//        currentLines.length - 1;
//        j >= 0;
//        j--
//     ) { 
//       dp[i][j] = selectedLines[i] === currentLines[j]
//        ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j] , dp[i][j+1], );
//     }
//   }
//   const result : DiffLine[] = [];
//   let  i = 0;
//   let j = 0;

//   while(
//     i < selectedLines.length &&
//     j < currentLines.length
//   ) { 
//     if(selectedLines[i] === currentLines[j]){
//     result.push({
//         type : "same", 
//         text : selectedLines[i],
//       });
//       i++;
//       j++;
//   } else if(
//     dp[i + 1][j] >= dp[i][j + 1]
//   ) { 
//     result.push({
//        type : "removed",
//        text : selectedLines[i],
//     });

//     i++;
//   }  else { 
//     result.push({
//       type : "added",
//       text : currentLines[j],
//     });
//     j++;
//   }
// }
 
// while(
//    i < selectedLines.length
// ) { 
//   result.push({ 
//     type : "removed",
//     text : selectedLines[i],
//   });
//   i++;
// }

// while(
//   j < currentLines.length
// ) { 
//   result.push({ 
//     type: "added", 
//     text: currentLines[j],
//   }); 
//   j++;
// }
// return result; 
// };

// const formatDate = ( 
//   value : 
//   AgentVersion["createdAt"],
// ) => 
//   new Date(value).toLocalString(
//     undefined, 
//      { 
//       dateStyle : "medium", 
//       timeStyle : "short", 
//      },
//   );


// export const AgentHistory = ({ 
//   agentId , 
//   currentName, 
//   currentInstructions,
// }: props) => { 
//   const trpc = useTRPC()
// }