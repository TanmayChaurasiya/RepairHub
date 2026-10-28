import { Response, NextFunction } from 'express';
import { RequestStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';

export async function getAdminDashboardStats(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Total counts by status
    const statusCountsRaw = await prisma.repairRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusCounts: Record<string, number> = {};
    Object.values(RequestStatus).forEach((st) => {
      statusCounts[st] = 0;
    });
    statusCountsRaw.forEach((row) => {
      statusCounts[row.status] = row._count.status;
    });

    // 2. Revenue from paid invoices
    const revenueAgg = await prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amountPaise: true },
    });
    const totalRevenuePaise = revenueAgg._sum.amountPaise || 0;

    // 3. Active (available) mechanics count
    const activeMechanicsCount = await prisma.mechanicProfile.count({
      where: { available: true },
    });
    const totalMechanicsCount = await prisma.mechanicProfile.count();

    // 4. Average mechanic rating
    const ratingAgg = await prisma.mechanicProfile.aggregate({
      _avg: { rating: true },
    });
    const averageMechanicRating = ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : 5.0;

    // 5. Open complaints count
    const openComplaintsCount = await prisma.complaint.count({
      where: { status: 'OPEN' },
    });

    // 6. Recent requests
    const recentRequests = await prisma.repairRequest.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        customer: { select: { id: true, name: true } },
        mechanic: { select: { id: true, name: true } },
        invoice: true,
        payment: true,
      },
    });

    res.json({
      statusCounts,
      totalRevenuePaise,
      activeMechanicsCount,
      totalMechanicsCount,
      averageMechanicRating,
      openComplaintsCount,
      recentRequests,
    });
  } catch (err) {
    next(err);
  }
}
