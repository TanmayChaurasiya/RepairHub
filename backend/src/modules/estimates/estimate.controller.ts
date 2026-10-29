import { Response, NextFunction } from 'express';
import { Role, RequestStatus, EstimateStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { emitRequestUpdated } from '../../services/socket.js';
import { FULL_REQUEST_INCLUDE } from '../requests/request.controller.js';

export async function createOrSendEstimate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId } = req.params;
    const { items } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: { estimates: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Role & ownership check
    if (req.user.role !== Role.ADMIN && request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'Only the assigned mechanic can create an estimate.' });
      return;
    }

    // Must be in INSPECTING (or revising from ESTIMATE_SENT/REJECTED)
    const allowedStatuses: RequestStatus[] = [
      RequestStatus.INSPECTING,
      RequestStatus.ESTIMATE_SENT,
      RequestStatus.REJECTED,
    ];
    if (!allowedStatuses.includes(request.status)) {
      res.status(409).json({
        error: `Cannot send estimate when request is in ${request.status} status.`,
      });
      return;
    }

    // Mark previous active estimates as SUPERSEDED
    await prisma.estimate.updateMany({
      where: {
        requestId,
        status: { in: [EstimateStatus.SENT, EstimateStatus.REJECTED] },
      },
      data: { status: EstimateStatus.SUPERSEDED },
    });

    // Calculate version
    const maxVersion = request.estimates.reduce((max, e) => Math.max(max, e.version), 0);
    const newVersion = maxVersion + 1;

    // Calculate line items and total
    let totalPaise = 0;
    const itemsData = items.map((item: any) => {
      const lineTotal = item.quantity * item.unitPricePaise;
      totalPaise += lineTotal;
      return {
        kind: item.kind,
        description: item.description,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPaise: lineTotal,
      };
    });

    const estimate = await prisma.estimate.create({
      data: {
        requestId,
        version: newVersion,
        status: EstimateStatus.SENT,
        totalPaise,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
      },
    });

    // Transition request to ESTIMATE_SENT
    await prisma.repairRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.ESTIMATE_SENT,
        statusHistory: {
          create: {
            fromStatus: request.status,
            toStatus: RequestStatus.ESTIMATE_SENT,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: `Estimate v${newVersion} sent (Total: ₹${(totalPaise / 100).toFixed(2)})`,
          },
        },
      },
    });

    const fullRequest = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: FULL_REQUEST_INCLUDE,
    });

    if (fullRequest) {
      emitRequestUpdated(requestId, fullRequest);
    }

    res.status(201).json({
      message: `Estimate version ${newVersion} created and sent successfully`,
      estimate,
      request: fullRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function decideEstimate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { estimateId } = req.params;
    const { decision, customerNote } = req.body;

    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        request: true,
        items: true,
      },
    });

    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    // Role check: Only customer (or admin) can approve/reject
    if (req.user.role === Role.CUSTOMER && estimate.request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'You can only approve or reject estimates for your own vehicle.' });
      return;
    }

    // Strict Rule: A superseded estimate can NEVER be approved or rejected
    if (estimate.status === EstimateStatus.SUPERSEDED) {
      res.status(409).json({
        error: 'A superseded estimate cannot be approved or rejected. Please review the latest estimate.',
      });
      return;
    }

    if (estimate.status !== EstimateStatus.SENT) {
      res.status(409).json({
        error: `Estimate is already ${estimate.status} and cannot be modified.`,
      });
      return;
    }

    const isApproval = decision === 'APPROVE';
    const newEstimateStatus = isApproval ? EstimateStatus.APPROVED : EstimateStatus.REJECTED;
    const newRequestStatus = isApproval ? RequestStatus.APPROVED : RequestStatus.REJECTED;

    // Update estimate
    const updatedEstimate = await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        status: newEstimateStatus,
        customerNote: customerNote || null,
      },
      include: { items: true },
    });

    // Update request status & statusHistory
    await prisma.repairRequest.update({
      where: { id: estimate.requestId },
      data: {
        status: newRequestStatus,
        statusHistory: {
          create: {
            fromStatus: estimate.request.status,
            toStatus: newRequestStatus,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: isApproval
              ? `Estimate v${estimate.version} approved by customer`
              : `Estimate v${estimate.version} rejected by customer: ${customerNote || 'No specific note'}`,
          },
        },
      },
    });

    const updatedRequest = await prisma.repairRequest.findUnique({
      where: { id: estimate.requestId },
      include: FULL_REQUEST_INCLUDE,
    });

    if (updatedRequest) {
      emitRequestUpdated(estimate.requestId, updatedRequest);
    }

    res.json({
      message: `Estimate ${isApproval ? 'approved' : 'rejected'} successfully`,
      estimate: updatedEstimate,
      request: updatedRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function reopenEstimate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId } = req.params;

    const request = await prisma.repairRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (req.user.role !== Role.ADMIN && request.mechanicId !== req.user.userId) {
      res.status(403).json({ error: 'Only the assigned mechanic can reopen the estimate.' });
      return;
    }

    if (request.status !== RequestStatus.ESTIMATE_SENT && request.status !== RequestStatus.REJECTED) {
      res.status(409).json({
        error: `Cannot reopen inspection from status ${request.status}. Only allowed from ESTIMATE_SENT or REJECTED.`,
      });
      return;
    }

    await prisma.repairRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.INSPECTING,
        statusHistory: {
          create: {
            fromStatus: request.status,
            toStatus: RequestStatus.INSPECTING,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: 'Inspection reopened to revise estimate',
          },
        },
      },
    });

    const updated = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: FULL_REQUEST_INCLUDE,
    });

    if (updated) {
      emitRequestUpdated(requestId, updated);
    }

    res.json({
      message: 'Inspection reopened for estimate revision',
      request: updated,
    });
  } catch (err) {
    next(err);
  }
}
