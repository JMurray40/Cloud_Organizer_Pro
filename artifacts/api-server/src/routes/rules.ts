import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, namingRulesTable } from "@workspace/db";
import {
  CreateRuleBody,
  UpdateRuleBody,
  UpdateRuleParams,
  DeleteRuleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rules", async (_req, res): Promise<void> => {
  const rules = await db
    .select()
    .from(namingRulesTable)
    .orderBy(namingRulesTable.priority);
  res.json(rules);
});

router.post("/rules", async (req, res): Promise<void> => {
  const parsed = CreateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rule] = await db
    .insert(namingRulesTable)
    .values({
      ...parsed.data,
      isActive: true,
      priority: parsed.data.priority ?? 0,
    })
    .returning();

  res.status(201).json(rule);
});

router.patch("/rules/:id", async (req, res): Promise<void> => {
  const params = UpdateRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rule] = await db
    .update(namingRulesTable)
    .set(parsed.data)
    .where(eq(namingRulesTable.id, params.data.id))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json(rule);
});

router.delete("/rules/:id", async (req, res): Promise<void> => {
  const params = DeleteRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rule] = await db
    .delete(namingRulesTable)
    .where(eq(namingRulesTable.id, params.data.id))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
