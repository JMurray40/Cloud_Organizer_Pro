import { Router, type IRouter } from "express";
import filesRouter from "./files";
import rulesRouter from "./rules";
import cloudAccountsRouter from "./cloud-accounts";
import statsRouter from "./stats";
import oauthRouter from "./oauth";
import historyRouter from "./history";

// NOTE: healthRouter is mounted separately in app.ts (before requireAuth).
const router: IRouter = Router();

router.use(filesRouter);
router.use(rulesRouter);
router.use(cloudAccountsRouter);
router.use(statsRouter);
router.use(oauthRouter);
router.use(historyRouter);

export default router;
