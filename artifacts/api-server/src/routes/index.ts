import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import rulesRouter from "./rules";
import cloudAccountsRouter from "./cloud-accounts";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(filesRouter);
router.use(rulesRouter);
router.use(cloudAccountsRouter);
router.use(statsRouter);

export default router;
