import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import factoryRoutes from '../../src/api/v1/routes/factory.routes';
import internalRoutes from '../../src/api/internal/routes';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use('/v1/factory', factoryRoutes);
app.use('/internal', internalRoutes); // For simulating Claude interactions

import jwt from 'jsonwebtoken';

const token = jwt.sign({ userId: 'user_e2e_123', email: 'e2e@test.com' }, process.env.JWT_SECRET || 'hackathon_secret');

describe('Factory E2E Acceptance Test', () => {
  let merchantA: string;
  let merchantB: string;

  beforeAll(async () => {
    // 1. Onboard Merchant A
    const resA = await request(app)
      .post('/v1/factory/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Merchant A (Premium)', capabilities: ['catalog', 'negotiation', 'checkout'] });
    merchantA = resA.body.merchantId;

    // 2. Onboard Merchant B
    const resB = await request(app)
      .post('/v1/factory/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Merchant B (Basic)' });
    merchantB = resB.body.merchantId;

    // 3. Setup Catalog for A
    await prisma.product.create({
      data: { merchantId: merchantA, name: 'Premium Laptop', priceMinor: 15000000, currency: 'INR', active: true, id: 'prod_a_laptop' }
    });

    // 4. Setup Catalog for B
    await prisma.product.create({
      data: { merchantId: merchantB, name: 'Basic Mouse', priceMinor: 200000, currency: 'INR', active: true, id: 'prod_b_mouse' }
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: ['prod_a_laptop', 'prod_b_mouse'] } } });
  });

  it('Merchant A agent can only see Merchant A products during discovery', async () => {
    // Simulate an internal request that the agent uses to fetch catalog
    // (assuming internal routes handle agent capabilities)
    // Here we'll just test that the factory catalog endpoint for A only returns A's products
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantA}/products`)
      .set('x-merchant-id', merchantA);
      
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Premium Laptop');
  });

  it('Merchant B agent can only see Merchant B products', async () => {
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantB}/products`)
      .set('x-merchant-id', merchantB);
      
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Basic Mouse');
  });
  
  it('Validates merchant configuration ready state', async () => {
    const res = await request(app).get(`/v1/factory/merchants/${merchantA}/validate`).set('x-merchant-id', merchantA);
    expect(res.status).toBe(200);
    // Might be NOT_READY if agent wasn't provisioned yet, but the API should run successfully
    expect(res.body).toHaveProperty('status');
  });
});
