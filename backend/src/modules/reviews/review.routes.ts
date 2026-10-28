import { Router } from 'express';
import { createReview } from './review.controller.js';
import { createReviewSchema } from './review.schema.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(createReviewSchema), createReview);

export default router;
