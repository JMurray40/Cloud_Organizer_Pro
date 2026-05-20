import { Router, type IRouter } from "express";
import { eq, and, ilike, or, inArray, desc } from "drizzle-orm";
import { db, filesTable, renameHistoryTable } from "@workspace/db";
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
import { getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/files", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListFilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, status, cloudAccountId, search } = parsed.data;

  const conditions = [eq(filesTable.userId, userId)];
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
    .where(and(...conditions))
    .orderBy(desc(filesTable.createdAt));

  res.json(files);
});

router.post("/files", async (req, res): Promise<void> => {
  const userId = getUserId(req);
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
      userId,
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

router.get("/files/duplicates", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const allFiles = await db
    .select()
    .from(filesTable)
    .where(eq(filesTable.userId, userId))
    .orderBy(filesTable.createdAt);

  const groups: Record<string, typeof allFiles> = {};
  for (const file of allFiles) {
    const normalised = file.originalName
      .toLowerCase()
      .replace(/\s*\(\d+\)\s*/g, "")
      .replace(/\s*-\s*copy\s*/gi, "")
      .replace(/\s*copy\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const base = normalised.replace(/\.[^.]+$/, "");
    // Skip empty/unparseable bases — they would otherwise lump unrelated files together.
    if (!base) continue;
    if (!groups[base]) groups[base] = [];
    groups[base].push(file);
  }

  const duplicateGroups = Object.entries(groups)
    .filter(([, files]) => files.length > 1 || files.some((f) => f.isDuplicate))
    .map(([key, files]) => ({
      groupKey: key,
      files,
      reason: files.some((f) => f.isDuplicate) ? "Flagged as duplicate" : "Similar filename detected",
    }));

  res.json(duplicateGroups);
});

router.post("/files/bulk-rename", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { fileIds, action } = req.body;

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    res.status(400).json({ error: "fileIds must be a non-empty array" });
    return;
  }
  if (fileIds.length > 500) {
    res.status(400).json({ error: "Bulk rename limited to 500 files per request" });
    return;
  }

  // Fetch all candidate files in ONE query, scoped to this user
  const candidates = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.userId, userId), inArray(filesTable.id, fileIds)));

  const candidateById = new Map(candidates.map((f) => [f.id, f]));

  let updated = 0;
  let skipped = 0;
  const scriptLines: string[] = [
    "#!/bin/bash",
    "# FileOrbit — Batch Rename Script",
    `# Generated: ${new Date().toISOString()}`,
    "set -euo pipefail",
    "",
  ];
  const ensuredDirs = new Set<string>();

  for (const id of fileIds) {
    const file = candidateById.get(id);
    if (!file || file.status === "organized") {
      skipped++;
      continue;
    }

    scriptLines.push(`# ${file.category}/${file.subCategory ?? "General"}`);
    if (file.suggestedPath && !ensuredDirs.has(file.suggestedPath)) {
      scriptLines.push(`mkdir -p "${file.suggestedPath}"`);
      ensuredDirs.add(file.suggestedPath);
    }
    if (file.suggestedPath) {
      scriptLines.push(`mv "${file.currentName}" "${file.suggestedPath}/${file.suggestedName}"`);
    } else {
      scriptLines.push(`mv "${file.currentName}" "${file.suggestedName}"`);
    }
    scriptLines.push("");

    if (action === "apply") {
      await db
        .update(filesTable)
        .set({ currentName: file.suggestedName, currentPath: file.suggestedPath, status: "organized" })
        .where(and(eq(filesTable.id, id), eq(filesTable.userId, userId)));

      await db.insert(renameHistoryTable).values({
        userId,
        fileId: file.id,
        fileOriginalName: file.originalName,
        action: "bulk_renamed",
        oldName: file.currentName,
        newName: file.suggestedName,
        oldStatus: file.status,
        newStatus: "organized",
        notes: "Applied via bulk rename",
      });
    }
    updated++;
  }

  res.json({
    updated,
    skipped,
    script: action === "download-script" ? scriptLines.join("\n") : null,
  });
});

router.post("/files/scan", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ScanFilesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { filenames } = parsed.data;
  if (filenames.length > 1000) {
    res.status(400).json({ error: "Scan limited to 1000 filenames per request" });
    return;
  }

  const existingFiles = await db
    .select({ currentName: filesTable.currentName })
    .from(filesTable)
    .where(eq(filesTable.userId, userId));
  const existingNames = existingFiles.map((f) => f.currentName);

  const results = filenames.map((filename: string) => {
    const detectedCategory = detectCategory(filename);
    const detectedSubCategory = detectSubCategory(filename, detectedCategory);
    const suggestion = applyNamingConvention(filename, detectedCategory, detectedSubCategory, existingNames);
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
      confidence: suggestion.confidence,
    };
  });

  res.json(results);
});

router.get("/files/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [file] = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.userId, userId)));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json(file);
});

router.patch("/files/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
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

  const [before] = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.userId, userId)));
  if (!before) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const [file] = await db
    .update(filesTable)
    .set(parsed.data)
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.userId, userId)))
    .returning();

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const statusChanged = parsed.data.status && parsed.data.status !== before.status;
  const nameChanged = parsed.data.currentName && parsed.data.currentName !== before.currentName;

  if (statusChanged || nameChanged) {
    const action = parsed.data.status === "organized" ? "organized"
      : parsed.data.status === "ignored" ? "ignored"
      : nameChanged ? "renamed"
      : "updated";

    await db.insert(renameHistoryTable).values({
      userId,
      fileId: file.id,
      fileOriginalName: file.originalName,
      action,
      oldName: nameChanged ? before.currentName : null,
      newName: nameChanged ? file.currentName : null,
      oldStatus: statusChanged ? before.status : null,
      newStatus: statusChanged ? file.status : null,
    });
  }

  res.json(file);
});

router.delete("/files/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [file] = await db
    .delete(filesTable)
    .where(and(eq(filesTable.id, params.data.id), eq(filesTable.userId, userId)))
    .returning();
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
