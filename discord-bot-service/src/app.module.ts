import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 1. เพิ่มตัวนี้
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordBotModule } from './modules/discord-bot/discord-bot.module';
import { AddressModule } from './modules/address/address.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // 2. ตั้งค่า ConfigModule ให้เป็น Global เพื่อให้ทุก Module ใช้ .env ได้
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DiscordBotModule,
    AddressModule,
    AuthModule,
    PrismaModule,
  ],
  controllers: [AppController],
  // 3. เอา PrismaService ออกจากตรงนี้ เพราะเรามี PrismaModule อยู่ใน imports แล้ว
  providers: [AppService],
})
export class AppModule {}
