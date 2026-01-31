import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // นำเข้า ConfigService
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { AddressService } from '../address/address.service';

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private client: Client;

  constructor(
    private readonly addressService: AddressService,
    private readonly configService: ConfigService, // Inject ConfigService เข้ามา
  ) {
    this.client = new Client({
      //สั่งให้บอททำหน้าที่อะไรบ้าง
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async onModuleInit() {
    // ดึง Token จากไฟล์ .env ผ่าน ConfigService
    const token = this.configService.get<string>('DISCORD_TOKEN');

    if (!token) {
      console.error('❌ ไม่พบ DISCORD_TOKEN ในไฟล์ .env นะเพื่อน!');
      return;
    }

    this.client.on('messageCreate', (message: Message) => {
      void this.handleMessage(message);
    });

    await this.client.login(token); // ใช้ตัวแปรแทนการพิมพ์ตรงๆ
    console.log('✅ บอทออนไลน์ผ่านระบบ Config เรียบร้อยละเพื่อน');
  }

  async onModuleDestroy() {
    console.log('กำลังตัดการเชื่อมต่อจาก Discord🔌');
    if (this.client) {
      this.client.destroy(); //อันนี้เอาไว้สั่งปิดบอท
    }
    console.log('✅ บอทออฟไลน์เรียบร้อยครับผม')
  }

  async handleMessage(message: Message) {
    if (message.author.bot) return;

    // 1. คำสั่งตรวจสอบที่อยู่ (Check)
    if (message.content === '!check') {
      const addresses = await this.addressService.getAddressesByDiscordId(message.author.id);
      if (addresses.length === 0) {
        return message.reply('📭 คุณยังไม่มีที่อยู่ที่บันทึกไว้เลยครับ');
      }
      const list = addresses.map((addr, index) =>
        `**${index + 1}. ${addr.fullName}**\n📍 ${addr.fullAddress}\n📞 ${addr.phoneNumber}\n🆔 ID: \`${addr.id}\``
      ).join('\n' + '─'.repeat(20) + '\n');
      await message.reply(`📋 **รายการที่อยู่ของคุณ:**\n\n${list}`);
    }

    // 2. คำสั่งบันทึกที่อยู่ (Save)
    else if (message.content.startsWith('!save')) {
      const content = message.content.replace('!save', '').trim();
      const parts = content.split('|').map((p) => p.trim());

      if (parts.length < 3) {
        return message.reply('❌ รูปแบบผิด! กรุณาใช้: `!save ชื่อจริง | ที่อยู่ | เบอร์โทร`');
      }

      const [fullName, fullAddress, phoneNumber] = parts;
      try {
        await this.addressService.saveAddress(message.author.id, message.author.username, {
          fullName,
          fullAddress,
          phoneNumber,
        });
        await message.reply(`✅ บันทึกที่อยู่ของคุณ **${fullName}** เรียบร้อย!`);
      } catch (error) {
        await message.reply('🚨 เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    }


    else if (message.content === '!delete') {
      try {
        const result = await this.addressService.deleteAddressByOwner(message.author.id);

        if (result.count === 0) {
          return message.reply('📭 คุณยังไม่มีข้อมูลที่อยู่ในระบบให้ลบเลยครับ');
        }

        await message.reply(`🗑️ ลบข้อมูลที่อยู่ทั้งหมดของคุณเรียบร้อยแล้วครับ (${result.count} รายการ)`);
      } catch (error) {
        await message.reply('🚨 เกิดข้อผิดพลาดในการลบข้อมูลครับ');
      }//อิงจาก UserId Discord ของผู้ใช้ไปเลยปลอดภัยกว่า จะได้ลบได้แค่ของตัวเอง
    }


  }
}
