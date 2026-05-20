import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, namingRulesTable } from "@workspace/db";
import {
  CreateRuleBody,
  UpdateRuleBody,
  UpdateRuleParams,
  DeleteRuleParams,
} from "@workspace/api-zod";
import { getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/rules", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const rules = await db
    .select()
    .from(namingRulesTable)
    .where(eq(namingRulesTable.userId, userId))
    .orderBy(asc(namingRulesTable.priority));
  res.json(rules);
});

router.post("/rules", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rule] = await db
    .insert(namingRulesTable)
    .values({
      userId,
      ...parsed.data,
      isActive: true,
      priority: parsed.data.priority ?? 0,
    })
    .returning();

  res.status(201).json(rule);
});

router.patch("/rules/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
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
    .where(and(eq(namingRulesTable.id, params.data.id), eq(namingRulesTable.userId, userId)))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json(rule);
});

router.delete("/rules/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rule] = await db
    .delete(namingRulesTable)
    .where(and(eq(namingRulesTable.id, params.data.id), eq(namingRulesTable.userId, userId)))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
