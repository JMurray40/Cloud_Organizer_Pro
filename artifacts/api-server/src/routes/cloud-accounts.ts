import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cloudAccountsTable } from "@workspace/db";
import {
  CreateCloudAccountBody,
  UpdateCloudAccountBody,
  UpdateCloudAccountParams,
  DeleteCloudAccountParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cloud-accounts", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(cloudAccountsTable).orderBy(cloudAccountsTable.createdAt);
  res.json(accounts);
});

router.post("/cloud-accounts", async (req, res): Promise<void> => {
  const parsed = CreateCloudAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
      ...parsed.data,
      rootPath: parsed.data.rootPath ?? null,
      isActive: true,
      fileCount: 0,
    })
    .returning();

  res.status(201).json(account);
});

router.patch("/cloud-accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateCloudAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCloudAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .update(cloudAccountsTable)
    .set(parsed.data)
    .where(eq(cloudAccountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.json(account);
});

router.delete("/cloud-accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteCloudAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .delete(cloudAccountsTable)
    .where(eq(cloudAccountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
