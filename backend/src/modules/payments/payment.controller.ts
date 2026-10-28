import { Response, NextFunction } from 'express';
import { Role, RequestStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { paymentProvider } from '../../services/payment/index.js';
import { emitRequestUpdated } from '../../services/socket.js';

export async function createPaymentOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: {
        invoice: true,
        customer: true,
        payment: true,
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    // Role & ownership check
    if (req.user.role === Role.CUSTOMER && request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You can only pay for your own repair request.' });
      return;
    }

    // Strict Rule: Payment only possible when COMPLETED
    if (request.status !== RequestStatus.COMPLETED) {
      res.status(409).json({
        error: `Payment is only possible when repair is COMPLETED. Current status: ${request.status}.`,
      });
      return;
    }

    if (request.payment && request.payment.status === PaymentStatus.SUCCESS) {
      res.status(409).json({ error: 'This invoice has already been paid.' });
      return;
    }

    if (!request.invoice) {
      res.status(400).json({ error: 'Invoice not yet generated for this request.' });
      return;
    }

    const order = await paymentProvider.createOrder({
      amountPaise: request.invoice.totalPaise,
      requestId: request.id,
      invoiceNumber: request.invoice.invoiceNumber,
      customerEmail: request.customer.email,
    });

    res.json({
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      provider: order.provider,
      invoiceNumber: request.invoice.invoiceNumber,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId, orderId, paymentId, signature } = req.body;

    const request = await prisma.repairRequest.findUnique({
      where: { id: requestId },
      include: {
        invoice: true,
        payment: true,
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Repair request not found' });
      return;
    }

    if (req.user.role === Role.CUSTOMER && request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You can only pay for your own repair request.' });
      return;
    }

    // Strict Rule: Payment only possible when COMPLETED
    if (request.status !== RequestStatus.COMPLETED) {
      res.status(409).json({
        error: `Payment is only possible when repair is COMPLETED. Current status: ${request.status}.`,
      });
      return;
    }

    if (!request.invoice) {
      res.status(400).json({ error: 'Invoice not found for this request.' });
      return;
    }

    // Verify payment with provider
    const isVerified = await paymentProvider.verifyPayment({
      orderId,
      paymentId,
      signature,
      amountPaise: request.invoice.totalPaise,
    });

    if (!isVerified) {
      res.status(400).json({ error: 'Payment verification failed.' });
      return;
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        requestId: request.id,
        invoiceId: request.invoice.id,
        amountPaise: request.invoice.totalPaise,
        provider: 'MOCK',
        transactionId: paymentId,
        status: PaymentStatus.SUCCESS,
      },
    });

    // Transition request to PAID
    const updated = await prisma.repairRequest.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.PAID,
        statusHistory: {
          create: {
            fromStatus: RequestStatus.COMPLETED,
            toStatus: RequestStatus.PAID,
            actorId: req.user.userId,
            actorRole: req.user.role,
            note: `Payment of ₹${(request.invoice.totalPaise / 100).toFixed(2)} completed successfully (Txn: ${paymentId})`,
          },
        },
      },
      include: {
        vehicle: true,
        customer: true,
        mechanic: true,
        invoice: true,
        payment: true,
        statusHistory: true,
      },
    });

    emitRequestUpdated(request.id, updated);

    res.json({
      message: 'Payment confirmed successfully',
      payment,
      request: updated,
    });
  } catch (err) {
    next(err);
  }
}
