import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // สร้าง Connection Pool ของ PostgreSQL
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // สร้าง Adapter ของ Prisma ที่ใช้ pool นั้น
    const adapter = new PrismaPg(pool);
    // ส่ง adapter ให้ PrismaClient
    super({ adapter });
  }

  // ก้อนนี้คือการทำตามคำมั่นสัญญาของ OnModuleInit
  async onModuleInit() {
    await this.$connect(); // สั่งให้เชื่อมต่อ Database ทันทีที่ App เริ่มทำงาน
  }

  // ก้อนนี้คือการทำตามคำมั่นสัญญาของ OnModuleDestroy
  async onModuleDestroy() {
    await this.$disconnect(); // สั่งให้ตัดการเชื่อมต่อ Database เมื่อเราปิด App
  }
}
