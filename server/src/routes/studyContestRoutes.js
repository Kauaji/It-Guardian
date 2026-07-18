import { Router } from "express";
import {
  answerQuestion,
  favoriteQuestion,
  getContestOverview,
  getContests,
  getQuestions,
  getSimulation,
  getWrongQuestions,
  saveExamAttempt
} from "../controllers/studyContestController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/contests", getContests);
router.get("/contests/:contestId", getContestOverview);
router.get("/contests/:contestId/questions", getQuestions);
router.get("/contests/:contestId/wrong", getWrongQuestions);
router.get("/contests/:contestId/simulation", getSimulation);
router.post("/questions/:questionId/answer", answerQuestion);
router.post("/questions/:questionId/favorite", favoriteQuestion);
router.post("/contests/:contestId/roles/:roleId/attempts", saveExamAttempt);

export default router;
