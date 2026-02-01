import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { AddressService } from '../address/address.service';

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private client: Client;

  // 🚩 ก้อนที่ 1: ตัวเก็บสถานะชั่วคราว (State Storage)
  // ใช้ Discord ID เป็น Key เพื่อจำว่าใครกำลังพิมพ์อะไรค้างไว้
  private userStates = new Map<string, { step: string; data: any }>();

  constructor(
    private readonly addressService: AddressService,
    private readonly configService: ConfigService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_TOKEN');
    if (!token) {
      console.error('❌ ไม่พบ DISCORD_TOKEN ในไฟล์ .env นะเพื่อน!');
      return;
    }

    this.client.on('messageCreate', (message: Message) => {
      void this.handleMessage(message);
    });

    await this.client.login(token);
    console.log('✅ บอทออนไลน์และพร้อมรองรับระบบถาม-ตอบทีละขั้นละเพื่อน');
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.destroy();
    }
    console.log('✅ บอทออฟไลน์แล้วนะเพื่อน');
  }

  async handleMessage(message: Message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const currentState = this.userStates.get(userId);

    // --- 1. คำสั่งพื้นฐาน (Global Commands) ---

    // เริ่มต้นระบบถาม-ตอบ
    if (message.content === '!checkin') {
      this.userStates.set(userId, { step: 'AWAITING_NAME', data: {} });
      return message.reply('ยินดีต้อนรับครับ! 🥳 รบกวนขอ **ชื่อ-นามสกุล** ของผู้รับหน่อยครับ');
    }

    if (message.content === '!check') {
      const addresses = await this.addressService.getAddressesByDiscordId(userId);
      if (addresses.length === 0) return message.reply('📭 ยังไม่มีข้อมูลที่อยู่เลยครับ');

      const list = addresses.map((addr, i) =>
        `**${i + 1}. ${addr.fullName}**\n📍 ${addr.fullAddress}\n📞 ${addr.phoneNumber}\n📧 ${addr.email}`
      ).join('\n' + '─'.repeat(20) + '\n');
      return message.reply(`📋 **รายการที่อยู่ของคุณ:**\n\n${list}`);
    }

    if (message.content === '!delete') {
      const result = await this.addressService.deleteAddressByOwner(userId);
      if (result.count === 0) return message.reply('📭 ไม่มีอะไรให้ลบครับ');
      return message.reply(`🗑️ ลบที่อยู่ทั้งหมดของคุณเรียบร้อย (${result.count} รายการ)`);
    }

    // --- 2. ระบบ Logic ถาม-ตอบ (State Flow) ---

    // ถ้าไม่มีสถานะค้างไว้ (ไม่ได้กด !checkin) ก็ไม่ต้องทำอะไรต่อ
    if (!currentState) return;

    switch (currentState.step) {
      case 'AWAITING_NAME':
        currentState.data.fullName = message.content;
        currentState.step = 'AWAITING_ADDRESS';
        await message.reply(`ขอบคุณครับคุณ **${message.content}** ต่อไปขอ **ที่อยู่จัดส่ง** อย่างละเอียดเลยครับ`);
        break;

      case 'AWAITING_ADDRESS':
        currentState.data.fullAddress = message.content;
        currentState.step = 'AWAITING_PHONE';
        await message.reply('รับทราบ! ขอ **เบอร์โทรศัพท์** สำหรับติดต่อด้วยครับ');
        break;

      case 'AWAITING_PHONE':
        currentState.data.phoneNumber = message.content;
        currentState.step = 'AWAITING_EMAIL';
        await message.reply('สุดท้ายแล้วครับเพื่อน ขอ **Email** ของคุณหน่อยครับ');
        break;

      case 'AWAITING_EMAIL':
        currentState.data.email = message.content;
        try {
          // บันทึกลงฐานข้อมูลจริงผ่าน AddressService (ตรวจสอบให้แน่ใจว่า Service อัปเดต email แล้ว)
          await this.addressService.saveAddress(userId, message.author.username, currentState.data);
          await message.reply('✅ บันทึกข้อมูลครบถ้วน! ชื่อ, ที่อยู่, เบอร์โทร และอีเมล ลงระบบเรียบร้อยแล้วครับ');
        } catch (error) {
          console.error(error);
          await message.reply('🚨 เกิดข้อผิดพลาดตอนบันทึก ลองเริ่มใหม่ด้วยคำสั่ง `!checkin` นะ');
        }
        // ลบสถานะทิ้งเพื่อให้จบขั้นตอน
        this.userStates.delete(userId);
        break;
    }
  }
}