import { Response, NextFunction } from 'express';
import { RequestStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { emitRequestUpdated } from '../../services/socket.js';
import { FULL_REQUEST_INCLUDE } from '../requests/request.controller.js';

export async function createReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId, rating, comment } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: { review: true, mechanic: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'You can only review your own repair request.' });
      return;
    }

    // Review only after payment
    if (request.status !== RequestStatus.PAID) {
      res.status(409).json({ error: 'Review can only be submitted after payment is completed.' });
      return;
    }

    if (request.review) {
      res.status(409).json({ error: 'You have already submitted a review for this request.' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        requestId,
        customerId: req.user.userId,
        rating,
        comment,
      },
    });

    // Update mechanic rating if mechanic assigned
    if (request.mechanicId) {
      const profile = await prisma.mechanicProfile.findUnique({
        where: { userId: request.mechanicId },
      });

      if (profile) {
        const newTotalReviews = profile.totalReviews + 1;
        const newRating =
          (profile.rating * profile.totalReviews + rating) / newTotalReviews;

        await prisma.mechanicProfile.update({
          where: { id: profile.id },
          data: {
            rating: Math.round(newRating * 10) / 10,
            totalReviews: newTotalReviews,
          },
        });
      }
    }

    const fullRequest = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: FULL_REQUEST_INCLUDE,
    });

    if (fullRequest) {
      emitRequestUpdated(requestId, fullRequest);
    }

    res.status(201).json({
      message: 'Review submitted successfully',
      review,
      request: fullRequest,
    });
  } catch (err) {
    next(err);
  }
}
