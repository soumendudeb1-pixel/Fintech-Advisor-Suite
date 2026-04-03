import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import calculatorRouter from "./calculator";
import aiRouter from "./ai";
import chatRouter from "./chat";
import calculateRouter from "./calculate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stocksRouter);
router.use(calculatorRouter);
router.use(aiRouter);
router.use(chatRouter);
router.use(calculateRouter);

export default router;
