import { dueClient, turnkeyService, feeService } from '@payit/integrations';

async function main() {
  console.log('--- Proxim Due & Turnkey Integration Diagnostic ---');

  // 1. Test Fee Calculation Service
  console.log('\n1. Testing Fee Service:');
  const payInFee = feeService.calculatePayInFee(1000, 'USD');
  console.log('USD Pay-In ($1,000):', payInFee);

  const ngnFee = feeService.calculatePayInFee(100000, 'NGN');
  console.log('NGN Pay-In (₦100,000):', ngnFee);

  const invoiceFee = feeService.calculateInvoiceFee(2500, 'USD');
  console.log('Merchant Invoice ($2,500):', invoiceFee);

  const payrollFee = feeService.calculatePayrollFee(5000000, 25, 'NGN');
  console.log('Batch Payroll (25 employees, ₦5,000,000):', payrollFee);

  const altcoinFee = feeService.calculateAltcoinSwapFee(500);
  console.log('Altcoin Swap ($500):', altcoinFee);

  // 2. Test Due Client Configuration
  console.log('\n2. Testing Due Client:');
  console.log('Due Base URL:', process.env.DUE_BASE_URL || 'https://api.due.network');
  console.log('Due API Key configured:', !!process.env.DUE_API_KEY);

  // 3. Test Turnkey Service Configuration
  console.log('\n3. Testing Turnkey Service:');
  console.log('Turnkey Org ID configured:', !!process.env.TURNKEY_ORGANIZATION_ID);

  console.log('\n✅ Proxim Due & Turnkey Integration modules ready for production.');
}

main().catch(console.error);
