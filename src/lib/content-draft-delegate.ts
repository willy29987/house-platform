import { prisma } from "@/lib/prisma";

export function getContentDraftDelegate() {
  return (prisma as any).contentDraft as
    | {
        findMany: (...args: any[]) => Promise<any[]>;
        findUnique: (...args: any[]) => Promise<any>;
        create: (...args: any[]) => Promise<any>;
        update: (...args: any[]) => Promise<any>;
      }
    | undefined;
}

export function missingContentDraftMessage() {
  return "內容佇列尚未初始化，請先執行：npx prisma migrate dev -n add_content_draft_pipeline";
}

