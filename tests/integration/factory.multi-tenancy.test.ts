import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import factoryRoutes from '../../src/api/v1/routes/factory.routes';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

import fs from 'fs';
app.use(express.json());
app.use('/v1/factory', factoryRoutes);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  fs.appendFileSync('test_errors.log', JSON.stringify({ message: err.message, stack: err.stack, name: err.name }) + '\n');
  res.status(500).json({ error: err.message });
});

import jwt from 'jsonwebtoken';
const tokenA = jwt.sign({ userId: 'userA_123', email: 'a@test.com' }, process.env.JWT_SECRET || 'hackathon_secret');
const tokenB = jwt.sign({ userId: 'userB_123', email: 'b@test.com' }, process.env.JWT_SECRET || 'hackathon_secret');

describe('Factory API Multi-Tenancy & Authorization', () => {
  let merchantAId: string;
  let merchantBId: string;

  beforeAll(async () => {
    // 0. Provision Users A and B
    await prisma.user.createMany({
      data: [
        { id: 'userA_123', email: 'a@test.com', password: 'hash' },
        { id: 'userB_123', email: 'b@test.com', password: 'hash' }
      ],
      skipDuplicates: true
    });

    // 1. Provision Merchant A
    const resA = await request(app)
      .post('/v1/factory/merchants')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Tenant A Store' });
    
    merchantAId = resA.body.merchantId;

    // 2. Provision Merchant B
    const resB = await request(app)
      .post('/v1/factory/merchants')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Tenant B Shop' });
    
    merchantBId = resB.body.merchantId;

    // 3. Create a product for Merchant A directly in DB to guarantee existence
    await prisma.product.create({
      data: {
        id: 'prod_a_123',
        merchantId: merchantAId,
        name: 'Tenant A Product',
        priceMinor: 1000,
        currency: 'USD',
        active: true
      }
    });
  });

  afterAll(async () => {
    // Cleanup products
    await prisma.product.deleteMany({ where: { id: 'prod_a_123' }});
    // The merchants will be left in DB for now, or we could delete them.
  });

  it('Merchant A should be able to get their own profile', async () => {
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.body.merchant.id).toBe(merchantAId);
  });

  it('Merchant B attempting to get Merchant A profile should be FORBIDDEN (or UNAUTHORIZED)', async () => {
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Missing Authorization header should be UNAUTHORIZED for protected routes', async () => {
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantAId}/catalog/products`);
    
    expect(res.status).toBe(401);
  });

  it('Merchant B cannot delete Merchant A products', async () => {
    const res = await request(app)
      .delete(`/v1/factory/merchants/${merchantAId}/products/prod_a_123`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    // Auth middleware catches path mismatch
    expect(res.status).toBe(403);
  });

  it('Merchant B attempting to use their own path to delete Merchant A product fails', async () => {
    const res = await request(app)
      .delete(`/v1/factory/merchants/${merchantBId}/products/prod_a_123`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    // The controller queries `where: { id: 'prod_a_123', merchantId: B }`
    // It should not find it.
    expect(res.status).toBe(500); // Because it throws an error in delete transaction, or 404 depending on Prisma error
  });

  it('Merchant A can access their own products', async () => {
    const res = await request(app)
      .get(`/v1/factory/merchants/${merchantAId}/products`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.products[0].name).toBe('Tenant A Product');
  });
});
