import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  garage: {
    name: string;
    address: string;
    city: string;
    phone: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    regNo: string;
    type: string;
  };
  items: Array<{
    kind: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
  totalPaise: number;
  payment?: {
    transactionId: string;
    status: string;
    createdAt: Date;
  } | null;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill('#0B1729');

      // Brand Title
      doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('RepairHub', 50, 30);
      doc.fontSize(10).font('Helvetica').fillColor('#22C7DB').text('Professional Garage Network', 50, 60);

      // Invoice Details (Right-aligned in header)
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', 350, 30, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#E2E8F0').text(`Invoice #: ${data.invoiceNumber}`, 350, 50, { align: 'right' });
      doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString('en-IN')}`, 350, 65, { align: 'right' });

      doc.moveDown(4);

      // Section: Garage and Customer Info
      const startY = 120;
      doc.fillColor('#0B1729').fontSize(11).font('Helvetica-Bold').text('SERVICE WORKSHOP:', 50, startY);
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      doc.text(data.garage.name, 50, startY + 16);
      doc.text(data.garage.address, 50, startY + 30);
      doc.text(`${data.garage.city} | Ph: ${data.garage.phone}`, 50, startY + 44);

      doc.fillColor('#0B1729').fontSize(11).font('Helvetica-Bold').text('BILLED TO (CUSTOMER):', 320, startY);
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      doc.text(data.customer.name, 320, startY + 16);
      doc.text(`Email: ${data.customer.email}`, 320, startY + 30);
      doc.text(`Phone: ${data.customer.phone}`, 320, startY + 44);

      // Vehicle Information Box
      const vehY = 190;
      doc.rect(50, vehY, 495, 45).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#0B1729').fontSize(10).font('Helvetica-Bold').text('VEHICLE DETAILS:', 65, vehY + 8);
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text(
        `${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.year}) | Reg: ${data.vehicle.regNo} | Type: ${data.vehicle.type}`,
        65,
        vehY + 24
      );

      // Items Table Header
      const tableTop = 255;
      doc.rect(50, tableTop, 495, 24).fill('#0B1729');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('KIND', 60, tableTop + 7);
      doc.text('DESCRIPTION', 120, tableTop + 7);
      doc.text('QTY', 340, tableTop + 7, { width: 40, align: 'center' });
      doc.text('RATE (₹)', 390, tableTop + 7, { width: 70, align: 'right' });
      doc.text('TOTAL (₹)', 470, tableTop + 7, { width: 65, align: 'right' });

      // Items Rows
      let currentY = tableTop + 24;
      data.items.forEach((item, index) => {
        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(50, currentY, 495, 22).fill('#F8FAFC');
        }

        doc.fillColor('#334155').font('Helvetica').fontSize(9);
        doc.fillColor(item.kind === 'LABOUR' ? '#FF8A3D' : '#22C7DB').font('Helvetica-Bold');
        doc.text(item.kind, 60, currentY + 6);

        doc.fillColor('#1E293B').font('Helvetica');
        doc.text(item.description, 120, currentY + 6, { width: 210, ellipsis: true });
        doc.text(item.quantity.toString(), 340, currentY + 6, { width: 40, align: 'center' });
        doc.text(formatINR(item.unitPricePaise), 390, currentY + 6, { width: 70, align: 'right' });
        doc.font('Helvetica-Bold').text(formatINR(item.totalPaise), 470, currentY + 6, { width: 65, align: 'right' });

        currentY += 22;
      });

      // Total Box
      currentY += 10;
      doc.rect(340, currentY, 205, 30).fill('#0B1729');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
      doc.text('GRAND TOTAL:', 350, currentY + 9);
      doc.fillColor('#FF8A3D').text(formatINR(data.totalPaise), 430, currentY + 9, { width: 105, align: 'right' });

      // Payment Status
      currentY += 45;
      if (data.payment && data.payment.status === 'SUCCESS') {
        doc.rect(50, currentY, 495, 40).fillAndStroke('#ECFDF5', '#A7F3D0');
        doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(10);
        doc.text('✓ PAID IN FULL', 65, currentY + 8);
        doc.font('Helvetica').fontSize(9).fillColor('#047857');
        doc.text(`Transaction Reference: ${data.payment.transactionId} | Method: Test Payment Gateway`, 65, currentY + 22);
      } else {
        doc.rect(50, currentY, 495, 35).fillAndStroke('#FEF3C7', '#FDE68A');
        doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(10);
        doc.text('PAYMENT PENDING', 65, currentY + 12);
      }

      // Footer
      doc.fontSize(8).fillColor('#94A3B8').font('Helvetica');
      doc.text(
        'This is a computer generated invoice and does not require a physical signature. Thank you for choosing RepairHub.',
        50,
        780,
        { align: 'center', width: 495 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
