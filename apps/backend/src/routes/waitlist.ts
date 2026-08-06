import { FastifyInstance } from 'fastify';
import { createDbClient } from '@payit/db';
import { waitlist } from '@payit/db/schema';
import { z } from 'zod';

const db = createDbClient();

// In-memory fallback list to ensure zero downtime for landing page signups
const inMemoryWaitlist: Array<{
  id: string;
  email: string;
  persona: string;
  preferredPlatform: string;
  createdAt: string;
}> = [];

const WaitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  persona: z.enum(['freelancer', 'founder', 'sme', 'interested'], {
    invalid_type_error: 'Please select your role or interest',
  }),
  preferredPlatform: z.enum(['webapp', 'telegram', 'both']).default('webapp'),
  source: z.string().default('website'),
});

export async function waitlistRoutes(server: FastifyInstance) {

  /**
   * POST /api/waitlist
   * Register email waitlist signup with role persona and preferred platform
   */
  server.post('/api/waitlist', async (request, reply) => {
    try {
      const parsed = WaitlistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0]?.message || 'Invalid waitlist submission data',
        });
      }

      const { email, persona, preferredPlatform, source } = parsed.data;
      const id = `wait_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const createdAtIso = new Date().toISOString();

      // Try persisting to PostgreSQL database
      try {
        await db.insert(waitlist).values({
          id,
          email: email.toLowerCase().trim(),
          persona,
          preferredPlatform,
          source,
          createdAt: new Date(),
        });
      } catch (dbErr: any) {
        console.warn('⚡ [Waitlist DB Warning] Database insert fallback to in-memory store:', dbErr.message);
        inMemoryWaitlist.push({
          id,
          email: email.toLowerCase().trim(),
          persona,
          preferredPlatform,
          createdAt: createdAtIso,
        });
      }

      return reply.send({
        success: true,
        message: "You're officially on the early access waitlist!",
        waitlistId: id,
        email,
        persona,
      });

    } catch (err: any) {
      console.error('Waitlist submission error:', err);
      return reply.status(500).send({ error: 'Failed to process waitlist submission. Please try again.' });
    }
  });

  /**
   * GET /api/waitlist
   * Retrieve total waitlist entries count & signups
   */
  server.get('/api/waitlist', async (request, reply) => {
    try {
      let dbEntries: any[] = [];
      try {
        dbEntries = await db.select().from(waitlist);
      } catch (err) {
        dbEntries = [];
      }

      const combined = [...dbEntries, ...inMemoryWaitlist];
      return reply.send({
        total: combined.length,
        signups: combined.slice(0, 100),
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch waitlist count' });
    }
  });
}
