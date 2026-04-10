import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, filesTable } from "@workspace/db";
import {
  CreateFileBody,
  UpdateFileBody,
  UpdateFileParams,
  GetFileParams,
  DeleteFileParams,
  ListFilesQueryParams,
  SuggestFileNameBody,
  ScanFilesBody,
} from "@workspace/api-zod";
import { applyNamingConvention } from "../lib/naming";

const router: IRouter = Router();

router.get("/files", async (req, res): Promise<void> => {
  const parsed = ListFilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, status, cloudAccountId, search } = parsed.data;

  const conditions = [];
  if (category) conditions.push(eq(filesTable.category, category));
  if (status) conditions.push(eq(filesTable.status, status));
  if (cloudAccountId != null) conditions.push(eq(filesTable.cloudAccountId, cloudAccountId));
  if (search) {
    conditions.push(
      or(
        ilike(filesTable.originalName, `%${search}%`),
        ilike(filesTable.suggestedName, `%${search}%`),
        ilike(filesTable.currentName, `%${search}%`)
      )!
    );
  }

  const files = await db
    .select()
    .from(filesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(filesTable.createdAt);

  res.json(files);
});

router.post("/files", async (req, res): Promise<void> => {
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { originalName, category, subCategory, cloudAccountId, fileSize, notes } = parsed.data;
  const suggestion = applyNamingConvention(originalName, category, subCategory ?? undefined);

  const [file] = await db
    .insert(filesTable)
    .values({
      originalName,
      suggestedName: suggestion.suggestedName,
      currentName: originalName,
      category,
      subCategory: subCategory ?? null,
      suggestedPath: suggestion.suggestedPath,
      cloudAccountId: cloudAccountId ?? null,
      fileSize: fileSize ?? null,
      fileExtension: suggestion.extension,
      notes: notes ?? null,
      isDuplicate: false,
      status: "pending",
    })
    .returning();

  res.status(201).json(file);
});

router.get("/files/suggest-name", async (req, res): Promise<void> => {
  res.status(405).json({ error: "Use POST" });
});

router.post("/files/suggest-name", async (req, res): Promise<void> => {
  const parsed = SuggestFileNameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { originalName, category, subCategory } = parsed.data;
  const suggestion = applyNamingConvention(originalName, category, subCategory ?? undefined);

  res.json({
    suggestedName: suggestion.suggestedName,
    suggestedPath: suggestion.suggestedPath,
    category,
    subCategory: subCategory ?? null,
    explanation: suggestion.explanation,
  });
});

router.post("/files/scan", async (req, res): Promise<void> => {
  const parsed = ScanFilesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { filenames } = parsed.data;

  const results = filenames.map((filename: string) => {
    const detectedCategory = detectCategory(filename);
    const detectedSubCategory = detectSubCategory(filename, detectedCategory);
    const suggestion = applyNamingConvention(filename, detectedCategory, detectedSubCategory);
    const isDuplicateRisk = filename.toLowerCase().includes("copy") ||
      filename.toLowerCase().includes("backup") ||
      /\(\d+\)/.test(filename) ||
      / - copy/i.test(filename);

    return {
      originalName: filename,
      suggestedName: suggestion.suggestedName,
      suggestedPath: suggestion.suggestedPath,
      category: detectedCategory,
      subCategory: detectedSubCategory ?? null,
      isDuplicateRisk,
      explanation: suggestion.explanation,
    };
  });

  res.json(results);
});

router.get("/files/:id", async (req, res): Promise<void> => {
  const params = GetFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [file] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json(file);
});

router.patch("/files/:id", async (req, res): Promise<void> => {
  const params = UpdateFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [file] = await db
    .update(filesTable)
    .set(parsed.data)
    .where(eq(filesTable.id, params.data.id))
    .returning();

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json(file);
});

router.delete("/files/:id", async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [file] = await db.delete(filesTable).where(eq(filesTable.id, params.data.id)).returning();
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendStatus(204);
});

function detectCategory(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() ?? "";

  if (["pdf", "doc", "docx", "txt", "odt"].includes(ext)) {
    if (/invoice|receipt|bill|payment/i.test(filename)) return "Finance";
    if (/contract|agreement|legal/i.test(filename)) return "Work";
    if (/proposal|report|presentation/i.test(filename)) return "Work";
    return "Work";
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    if (/budget|finance|tax|receipt/i.test(filename)) return "Finance";
    return "Work";
  }
  if (["ppt", "pptx"].includes(ext)) return "Work";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "Personal";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "Media";
  if (["mp3", "wav", "flac", "aac"].includes(ext)) return "Media";
  if (/invoice|receipt|bill/i.test(filename)) return "Finance";
  if (/vacation|trip|travel|holiday/i.test(filename)) return "Personal";
  if (/project|client/i.test(filename)) return "Projects";
  return "Work";
}

function detectSubCategory(filename: string, category: string): string | undefined {
  const lower = filename.toLowerCase();
  if (category === "Work") {
    if (/report/i.test(filename)) return "Reports";
    if (/contract|agreement/i.test(filename)) return "Contracts";
    if (/proposal/i.test(filename)) return "Proposals";
    if (/invoice/i.test(filename)) return "Invoices";
    if (/presentation|slides|deck/i.test(filename)) return "Presentations";
    return "Reports";
  }
  if (category === "Finance") {
    if (/receipt/i.test(filename)) return "Receipts";
    if (/tax/i.test(filename)) return "Tax";
    if (/bank|statement/i.test(filename)) return "Banking";
    if (/insurance/i.test(filename)) return "Insurance";
    return "Receipts";
  }
  if (category === "Personal") {
    const ext = lower.split(".").pop() ?? "";
    if (["jpg", "jpeg", "png", "gif", "heic", "webp"].includes(ext)) return "Photos";
    if (/health|medical|doctor/i.test(filename)) return "Health";
    if (/legal|will|deed/i.test(filename)) return "Legal";
    if (/school|university|degree|diploma/i.test(filename)) return "Education";
    if (/trip|travel|vacation|hotel/i.test(filename)) return "Travel";
    return "Photos";
  }
  if (category === "Media") {
    const ext = lower.split(".").pop() ?? "";
    if (["jpg", "jpeg", "png", "gif", "heic", "webp"].includes(ext)) return "Photos";
    if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "Videos";
    if (["mp3", "wav", "flac", "aac"].includes(ext)) return "Audio";
    return "Photos";
  }
  return undefined;
}

export default router;
