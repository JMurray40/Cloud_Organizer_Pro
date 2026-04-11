import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, renameHistoryTable, filesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/history", async (req, res): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  const entries = await db
    .select()
    .from(renameHistoryTable)
    .orderBy(desc(renameHistoryTable.performedAt))
    .limit(limit);

  res.json(entries);
});

router.post("/history", async (req, res): Promise<void> => {
  const { fileId, fileOriginalName, action, oldName, newName, oldStatus, newStatus, notes } = req.body;

  if (!fileOriginalName || !action) {
    res.status(400).json({ error: "fileOriginalName and action are required" });
    return;
  }

  const [entry] = await db
    .insert(renameHistoryTable)
    .values({
      fileId: fileId ?? null,
      fileOriginalName,
      action,
      oldName: oldName ?? null,
      newName: newName ?? null,
      oldStatus: oldStatus ?? null,
      newStatus: newStatus ?? null,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(entry);
});

router.post("/history/:id/undo", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [entry] = await db.select().from(renameHistoryTable).where(eq(renameHistoryTable.id, id));
  if (!entry) {
    res.status(404).json({ error: "History entry not found" });
    return;
  }

  if (!entry.fileId) {
    res.json({ success: false, message: "Cannot undo — original file record no longer exists", restoredStatus: null });
    return;
  }

  const [file] = await db.select().from(filesTable).where(eq(filesTable.id, entry.fileId));
  if (!file) {
    res.json({ success: false, message: "File record not found — it may have been deleted", restoredStatus: null });
    return;
  }

  const updates: Partial<typeof filesTable.$inferInsert> = {};
  if (entry.oldStatus) updates.status = entry.oldStatus;
  if (entry.oldName) updates.currentName = entry.oldName;

  if (Object.keys(updates).length === 0) {
    res.json({ success: false, message: "Nothing to undo for this action", restoredStatus: null });
    return;
  }

  await db.update(filesTable).set(updates).where(eq(filesTable.id, entry.fileId));

  await db.insert(renameHistoryTable).values({
    fileId: entry.fileId,
    fileOriginalName: entry.fileOriginalName,
    action: "undo",
    oldName: entry.newName,
    newName: entry.oldName,
    oldStatus: entry.newStatus,
    newStatus: entry.oldStatus,
    notes: `Undid action #${entry.id}: ${entry.action}`,
  });

  res.json({
    success: true,
    message: `Reverted "${entry.fileOriginalName}" to status "${entry.oldStatus ?? "previous"}"`,
    restoredStatus: entry.oldStatus ?? null,
  });
});

export default router;
