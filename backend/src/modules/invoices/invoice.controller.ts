import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { AuthenticatedRequest } from '../../types/index.js';
import { generateInvoicePdfBuffer } from '../../services/pdf/invoicePdf.js';

export async function getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            vehicle: true,
            customer: { select: { id: true, name: true, email: true, phone: true } },
            garage: true,
            estimates: {
              where: { status: 'APPROVED' },
              include: { items: true },
            },
          },
        },
        payment: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (req.user.role === Role.CUSTOMER && invoice.request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You do not own this invoice.' });
      return;
    }

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
}

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            vehicle: true,
            customer: true,
            garage: true,
            estimates: {
              where: { status: 'APPROVED' },
              include: { items: true },
            },
          },
        },
        payment: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (req.user.role === Role.CUSTOMER && invoice.request.customerId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. You cannot download another customer’s invoice.' });
      return;
    }

    const approvedEstimate = invoice.request.estimates[0];
    const items = approvedEstimate?.items || [];

    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      garage: invoice.request.garage,
      customer: invoice.request.customer,
      vehicle: invoice.request.vehicle,
      items,
      totalPaise: invoice.totalPaise,
      payment: invoice.payment,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
