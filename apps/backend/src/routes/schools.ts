import { FastifyInstance } from 'fastify';
import { and, createDbClient, eq, inArray } from '@payit/db';
import { accounts, entities, schoolApplications, schoolCampuses, schoolClasses, schoolStudents, studentPaymentAccounts, schoolFeeSchedules, schoolStaff, staffBankAccounts, schoolSavingsPolicies } from '@payit/db/schema';
import { BrailsClient } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();

async function ownedSchool(entityId: string, userId: string) {
  const rows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, userId), eq(entities.kind, 'BUSINESS'))).limit(1);
  return rows[0] || null;
}

function clean(value: any) {
  return String(value ?? '').trim();
}

export async function schoolRoutes(server: FastifyInstance) {
  server.post('/api/schools/applications', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const required = ['schoolLegalName', 'registrationNumber', 'adminName', 'adminEmail', 'adminPhone', 'country', 'industry', 'description', 'incorporationDate', 'address', 'city', 'state', 'postalCode', 'adminDateOfBirth', 'adminNationality', 'adminGender', 'adminIdType', 'adminIdNumber', 'adminIdFrontUrl', 'proofOfAddressUrl', 'taxId', 'taxIdType'];
    if (required.some(field => !clean(body[field]))) return reply.status(400).send({ error: 'Complete school business, address, tax, authorized-admin, identity-document, and proof-of-address fields are required' });
    const applicationId = `school_app_${ulid()}`;
    const applicationValues = { id: applicationId, schoolLegalName: clean(body.schoolLegalName), registrationNumber: clean(body.registrationNumber), adminName: clean(body.adminName), adminEmail: clean(body.adminEmail).toLowerCase(), adminPhone: clean(body.adminPhone), country: clean(body.country).toUpperCase(), status: 'KYB_REVIEW' as const };
    const rows = await db.insert(schoolApplications).values({ ...applicationValues, applicationData: body }).returning();
    const adminNames = applicationValues.adminName.split(/\s+/);
    const brails = new BrailsClient();
    try {
      const providerResponse = await brails.submitBusinessKyb({
        firstName: adminNames[0] || applicationValues.adminName,
        lastName: adminNames.slice(1).join(' ') || adminNames[0] || applicationValues.adminName,
        email: applicationValues.adminEmail,
        phoneNumber: applicationValues.adminPhone,
        businessLegalName: applicationValues.schoolLegalName,
        registrationNumber: applicationValues.registrationNumber,
        businessInformation: {
          registrationNumber: applicationValues.registrationNumber,
          email: applicationValues.adminEmail,
          type: 'corporate',
          industry: 'education',
          accountPurpose: 'School collections and student-linked payment references',
          description: clean(body.description),
          address: { streetLine1: clean(body.address), city: clean(body.city), state: clean(body.state), postalCode: clean(body.postalCode), country: applicationValues.country },
          website: clean(body.website) || undefined,
          dateOfIncorporation: clean(body.incorporationDate),
          annualRevenue: clean(body.annualRevenue) || undefined,
          estimatedMonthlyDeposits: clean(body.estimatedMonthlyDeposits) || undefined,
          estimatedMonthlyWithdrawals: clean(body.estimatedMonthlyWithdrawals) || undefined,
          sourceOfFunds: clean(body.sourceOfFunds) || undefined,
          taxInformation: { taxId: clean(body.taxId), taxIdType: clean(body.taxIdType), taxCountry: applicationValues.country },
        },
        businessOfficer: { address: { streetLine1: clean(body.adminAddress || body.address), city: clean(body.city), state: clean(body.state), postalCode: clean(body.postalCode), country: applicationValues.country }, identifyingInformation: { type: clean(body.adminIdType) as any, number: clean(body.adminIdNumber), issuingCountry: applicationValues.country, idFrontImage: clean(body.adminIdFrontUrl), idBackImage: clean(body.adminIdBackUrl) || undefined }, primaryNationality: clean(body.adminNationality), gender: clean(body.adminGender) as any },
        businessOfficerIdentity: { type: clean(body.adminIdType) as any, number: clean(body.adminIdNumber), issuingCountry: applicationValues.country, idFrontImage: clean(body.adminIdFrontUrl), idBackImage: clean(body.adminIdBackUrl) || undefined },
        businessOfficerNationality: clean(body.adminNationality),
        businessOfficerGender: clean(body.adminGender) as any,
        businessOfficerDateOfBirth: clean(body.adminDateOfBirth),
        businessOfficerBvn: clean(body.adminBvn) || undefined,
        businessOfficerNin: clean(body.adminNin) || undefined,
        complianceInformation: [{ name: 'Authorized administrator identity document', url: clean(body.adminIdFrontUrl) }, { name: 'Proof of school address', url: clean(body.proofOfAddressUrl) }, ...(clean(body.registrationDocumentUrl) ? [{ name: 'School registration document', url: clean(body.registrationDocumentUrl) }] : [])],
        reference: applicationId,
      });
      const providerData = providerResponse?.data || providerResponse;
      const brailsCustomerId = String(providerData?.id || providerData?.customerId || providerData?.customer_id || '');
      const brailsStatus = String(providerData?.status || providerData?.kybStatus || providerData?.kyb_status || 'PENDING');
      const updated = await db.update(schoolApplications).set({ brailsCustomerId: brailsCustomerId || null, brailsStatus, brailsPayload: providerResponse }).where(eq(schoolApplications.id, applicationId)).returning();
      return reply.status(201).send({ success: true, application: updated[0], provider: 'BRAILS', nextStep: 'WAIT_FOR_BRAILS_KYB_APPROVAL' });
    } catch (error: any) {
      const updated = await db.update(schoolApplications).set({ brailsStatus: 'SUBMISSION_FAILED', brailsPayload: { error: error.message } }).where(eq(schoolApplications.id, applicationId)).returning();
      return reply.status(502).send({ success: false, application: updated[0], provider: 'BRAILS', error: 'School application was saved, but Brails KYB submission failed. Please retry.' });
    }
  });

  server.post('/api/schools/onboard', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const legalName = clean(body.legalName);
    const registrationNumber = clean(body.registrationNumber);
    if (!legalName || !registrationNumber) return reply.status(400).send({ error: 'School legal name and registration number are required' });
    const existing = await db.select().from(entities).where(and(eq(entities.id, request.session!.activeEntityId), eq(entities.userId, request.session!.userId), eq(entities.kind, 'BUSINESS'))).limit(1);
    if (!existing[0]) return reply.status(403).send({ error: 'A business entity is required before school onboarding' });
    const rows = await db.update(entities).set({ legalName, registrationNumber, dueStatus: 'pending', businessTag: clean(body.businessTag) || existing[0].businessTag }).where(eq(entities.id, existing[0].id)).returning();
    return reply.status(201).send({ success: true, school: rows[0], nextStep: 'KYB_VERIFICATION' });
  });

  server.get('/api/schools/:entityId/overview', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const school = await ownedSchool(entityId, request.session!.userId);
    if (!school) return reply.status(403).send({ error: 'A business school entity owned by the authenticated user is required' });
    const [campuses, classes, students, staff, policies, fees] = await Promise.all([
      db.select().from(schoolCampuses).where(eq(schoolCampuses.entityId, entityId)),
      db.select().from(schoolClasses).where(eq(schoolClasses.entityId, entityId)),
      db.select().from(schoolStudents).where(eq(schoolStudents.entityId, entityId)),
      db.select().from(schoolStaff).where(eq(schoolStaff.entityId, entityId)),
      db.select().from(schoolSavingsPolicies).where(eq(schoolSavingsPolicies.entityId, entityId)),
      db.select().from(schoolFeeSchedules).where(eq(schoolFeeSchedules.entityId, entityId)),
    ]);
    return reply.send({ success: true, school, counts: { campuses: campuses.length, classes: classes.length, students: students.length, staff: staff.length }, campuses, classes, students, staff, fees, savingsPolicies: policies });
  });

  server.post('/api/schools/:entityId/campuses', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    if (!clean(body.name)) return reply.status(400).send({ error: 'Campus name is required' });
    const rows = await db.insert(schoolCampuses).values({ id: `camp_${ulid()}`, entityId, name: clean(body.name), address: clean(body.address) || null }).returning();
    return reply.status(201).send({ success: true, campus: rows[0] });
  });

  server.post('/api/schools/:entityId/classes', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    if (!clean(body.name)) return reply.status(400).send({ error: 'Class name is required' });
    const rows = await db.insert(schoolClasses).values({ id: `class_${ulid()}`, entityId, campusId: clean(body.campusId) || null, name: clean(body.name), academicSession: clean(body.academicSession) || null, term: clean(body.term) || null }).returning();
    return reply.status(201).send({ success: true, class: rows[0] });
  });

  server.get('/api/schools/:entityId/fees', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const fees = await db.select().from(schoolFeeSchedules).where(eq(schoolFeeSchedules.entityId, entityId));
    return reply.send({ success: true, fees });
  });

  server.post('/api/schools/:entityId/students', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    const name = clean(body.fullName);
    const studentNumber = clean(body.studentNumber);
    if (!name || !studentNumber || !clean(body.classId)) return reply.status(400).send({ error: 'fullName, studentNumber, and classId are required' });
    const existing = await db.select().from(schoolStudents).where(and(eq(schoolStudents.entityId, entityId), eq(schoolStudents.studentNumber, studentNumber))).limit(1);
    if (existing[0]) return reply.status(409).send({ error: 'Student number already exists for this school' });
    const studentRows = await db.insert(schoolStudents).values({ id: `student_${ulid()}`, entityId, classId: clean(body.classId), studentNumber, fullName: name, parentName: clean(body.parentName) || null, parentEmail: clean(body.parentEmail) || null, parentPhone: clean(body.parentPhone) || null, status: 'ACTIVE' }).returning();
    return reply.status(201).send({ success: true, student: studentRows[0] });
  });

  server.post('/api/schools/:entityId/students/import', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as { students?: Array<Record<string, any>> };
    if (!Array.isArray(body.students) || body.students.length === 0) return reply.status(400).send({ error: 'students must be a non-empty array. Parse the Excel template in the dashboard before submitting.' });
    const values = body.students.map(student => ({ id: `student_${ulid()}`, entityId, classId: clean(student.classId), studentNumber: clean(student.studentNumber), fullName: clean(student.fullName), parentName: clean(student.parentName) || null, parentEmail: clean(student.parentEmail) || null, parentPhone: clean(student.parentPhone) || null, status: 'ACTIVE' as const }));
    if (values.some(student => !student.classId || !student.studentNumber || !student.fullName)) return reply.status(400).send({ error: 'Every student requires classId, studentNumber, and fullName' });
    const rows = await db.insert(schoolStudents).values(values).returning();
    return reply.status(201).send({ success: true, imported: rows.length, students: rows });
  });

  server.post('/api/schools/:entityId/students/:studentId/payment-accounts', async (request, reply) => {
    const { entityId, studentId } = request.params as { entityId: string; studentId: string };
    const school = await ownedSchool(entityId, request.session!.userId);
    if (!school) return reply.status(403).send({ error: 'School access denied' });
    const student = (await db.select().from(schoolStudents).where(and(eq(schoolStudents.id, studentId), eq(schoolStudents.entityId, entityId))).limit(1))[0];
    if (!student) return reply.status(404).send({ error: 'Student not found' });
    const masterAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
    if (!masterAccounts.length) return reply.status(409).send({ error: 'Create and verify a school master account before generating student payment accounts' });
    const requestedCurrencies = ((request.body as any)?.currencies || masterAccounts.map(account => account.currency)) as string[];
    const allowed = new Set(masterAccounts.map(account => account.currency.toUpperCase()));
    const values = requestedCurrencies.filter(currency => allowed.has(String(currency).toUpperCase())).map(currency => {
      const normalized = String(currency).toUpperCase();
      const master = masterAccounts.find(account => account.currency.toUpperCase() === normalized)!;
      return { id: `student_account_${ulid()}`, entityId, studentId, currency: normalized, mode: 'SCHOOL_MASTER_REFERENCE' as const, masterAccountId: master.id, paymentReference: `${school.businessTag || 'SCHOOL'}-${student.studentNumber}-${normalized}`.toUpperCase(), status: 'ACTIVE' as const };
    });
    if (!values.length) return reply.status(400).send({ error: 'No requested currencies match the school master accounts' });
    const rows = await db.insert(studentPaymentAccounts).values(values).onConflictDoNothing().returning();
    return reply.status(201).send({ success: true, accounts: rows, note: 'Student payment identities route funds to school-owned master accounts; students and parents do not operate these accounts.' });
  });

  server.post('/api/schools/:entityId/fees', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    const amount = Number(body.amount);
    if (!clean(body.name) || !clean(body.classId) || !Number.isFinite(amount) || amount <= 0 || !clean(body.currency)) return reply.status(400).send({ error: 'name, classId, positive amount, and currency are required' });
    const rows = await db.insert(schoolFeeSchedules).values({ id: `fee_${ulid()}`, entityId, classId: clean(body.classId), name: clean(body.name), amount: String(amount), currency: clean(body.currency).toUpperCase(), dueDate: clean(body.dueDate) || null, academicSession: clean(body.academicSession) || null, term: clean(body.term) || null, status: 'ACTIVE' }).returning();
    return reply.status(201).send({ success: true, fee: rows[0] });
  });

  server.post('/api/schools/:entityId/staff', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    if (!clean(body.fullName) || !clean(body.staffNumber)) return reply.status(400).send({ error: 'fullName and staffNumber are required' });
    const staffRows = await db.insert(schoolStaff).values({ id: `staff_${ulid()}`, entityId, staffNumber: clean(body.staffNumber), fullName: clean(body.fullName), role: clean(body.role) || null, department: clean(body.department) || null, employmentType: clean(body.employmentType) || 'EMPLOYEE', status: 'ACTIVE' }).returning();
    if (body.bankAccount) await db.insert(staffBankAccounts).values({ id: `staff_bank_${ulid()}`, staffId: staffRows[0].id, bankName: clean(body.bankAccount.bankName), accountNumber: clean(body.bankAccount.accountNumber), accountName: clean(body.bankAccount.accountName || body.fullName), bankCode: clean(body.bankAccount.bankCode) || null, isDefault: true, status: 'PENDING_VERIFICATION' });
    return reply.status(201).send({ success: true, staff: staffRows[0] });
  });

  server.post('/api/schools/:entityId/savings-policy', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!await ownedSchool(entityId, request.session!.userId)) return reply.status(403).send({ error: 'School access denied' });
    const body = request.body as Record<string, any>;
    const percentage = Number(body.percentage || 0);
    if (percentage < 0 || percentage > 100) return reply.status(400).send({ error: 'percentage must be between 0 and 100' });
    const rows = await db.insert(schoolSavingsPolicies).values({ id: `school_savings_${ulid()}`, entityId, name: clean(body.name) || 'School Reserve', mode: percentage > 0 ? 'PERCENTAGE_OF_PAYMENT' : 'MANUAL', percentage: String(percentage), fixedAmount: clean(body.fixedAmount) || null, targetAmount: clean(body.targetAmount) || null, currency: clean(body.currency) || 'USD', status: body.enabled === false ? 'DISABLED' : 'ACTIVE' }).returning();
    return reply.status(201).send({ success: true, policy: rows[0], note: 'Savings execution remains behind the Proxim treasury layer.' });
  });
}
