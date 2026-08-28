/**
 * Invoice Image & Graphic Generator
 * Generates structured SVG/HTML invoice graphics for Telegram delivery
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceGraphicParams {
  invoiceNumber: string;
  businessName: string;
  clientName: string;
  clientEmail?: string;
  currency: string;
  items: InvoiceItem[];
  dueDate: string;
  paymentUrl: string;
  walletDepositAddress?: string;
}

export class InvoiceImageRenderer {
  /**
   * Generates a high-fidelity SVG string representing a luxury dark-mode Proxim invoice card.
   */
  public generateInvoiceSvg(params: InvoiceGraphicParams): string {
    const currencySymbol = params.currency === 'NGN' ? '₦' : params.currency === 'GBP' ? '£' : params.currency === 'EUR' ? '€' : '$';
    
    let subtotal = 0;
    const itemRows = params.items
      .map((item, idx) => {
        const total = item.quantity * item.unitPrice;
        subtotal += total;
        const y = 240 + idx * 36;
        return `
          <text x="50" y="${y}" fill="#ffffff" font-size="14" font-family="system-ui, sans-serif">${item.description}</text>
          <text x="360" y="${y}" fill="#9fb4b0" font-size="14" font-family="system-ui, sans-serif" text-anchor="middle">${item.quantity}</text>
          <text x="460" y="${y}" fill="#9fb4b0" font-size="14" font-family="system-ui, sans-serif" text-anchor="end">${currencySymbol}${item.unitPrice.toLocaleString()}</text>
          <text x="550" y="${y}" fill="#7ee2c3" font-size="14" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="end">${currencySymbol}${total.toLocaleString()}</text>
        `;
      })
      .join('');

    const totalY = 240 + params.items.length * 36 + 40;
    const cardHeight = Math.max(480, totalY + 120);

    return `
      <svg width="600" height="${cardHeight}" viewBox="0 0 600 ${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#061814" />
            <stop offset="50%" stop-color="#0b241e" />
            <stop offset="100%" stop-color="#05100d" />
          </linearGradient>
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#d6b65a" />
            <stop offset="100%" stop-color="#f6e199" />
          </linearGradient>
        </defs>

        <!-- Card Background -->
        <rect width="600" height="${cardHeight}" rx="24" fill="url(#bg-grad)" stroke="#22423b" stroke-width="2" />

        <!-- Header -->
        <text x="50" y="55" fill="url(#gold-grad)" font-size="18" font-weight="bold" letter-spacing="2" font-family="system-ui, sans-serif">PROXIM INVOICE</text>
        <text x="550" y="55" fill="#7ee2c3" font-size="14" font-family="monospace" text-anchor="end">#${params.invoiceNumber}</text>

        <!-- Business & Client Details -->
        <text x="50" y="100" fill="#9fb4b0" font-size="11" text-transform="uppercase" font-family="system-ui, sans-serif">Billed From</text>
        <text x="50" y="122" fill="#ffffff" font-size="16" font-weight="bold" font-family="system-ui, sans-serif">${params.businessName}</text>

        <text x="350" y="100" fill="#9fb4b0" font-size="11" text-transform="uppercase" font-family="system-ui, sans-serif">Billed To</text>
        <text x="350" y="122" fill="#ffffff" font-size="16" font-weight="bold" font-family="system-ui, sans-serif">${params.clientName}</text>
        ${params.clientEmail ? `<text x="350" y="142" fill="#9fb4b0" font-size="12" font-family="system-ui, sans-serif">${params.clientEmail}</text>` : ''}

        <text x="50" y="155" fill="#9fb4b0" font-size="12" font-family="system-ui, sans-serif">Due Date: <tspan fill="#ffffff" font-weight="bold">${params.dueDate}</tspan></text>

        <!-- Table Header Bar -->
        <rect x="40" y="180" width="520" height="32" rx="8" fill="#102d26" />
        <text x="50" y="201" fill="#9fb4b0" font-size="11" font-weight="bold" font-family="system-ui, sans-serif">ITEM DESCRIPTION</text>
        <text x="360" y="201" fill="#9fb4b0" font-size="11" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">QTY</text>
        <text x="460" y="201" fill="#9fb4b0" font-size="11" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="end">PRICE</text>
        <text x="550" y="201" fill="#9fb4b0" font-size="11" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="end">AMOUNT</text>

        <!-- Line Items -->
        ${itemRows}

        <!-- Divider -->
        <line x1="40" y1="${totalY - 15}" x2="560" y2="${totalY - 15}" stroke="#22423b" stroke-width="1" />

        <!-- Total -->
        <text x="400" y="${totalY + 15}" fill="#9fb4b0" font-size="14" font-family="system-ui, sans-serif" text-anchor="end">Total Amount Due:</text>
        <text x="550" y="${totalY + 15}" fill="url(#gold-grad)" font-size="22" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="end">${currencySymbol}${subtotal.toLocaleString()}</text>

        <!-- Footer / Payment Link -->
        <rect x="40" y="${totalY + 45}" width="520" height="42" rx="10" fill="#0d2e26" stroke="#1d4d40" />
        <text x="300" y="${totalY + 71}" fill="#7ee2c3" font-size="13" font-weight="bold" font-family="system-ui, sans-serif" text-anchor="middle">Pay online instantly at ${params.paymentUrl}</text>
      </svg>
    `;
  }
}

export const invoiceImageRenderer = new InvoiceImageRenderer();
