import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // นำเข้า ConfigService
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { AddressService } from '../address/address.service';

@Injectable()
export class DiscordBotService implements OnModuleInit {
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

  async handleMessage(message: Message) {
    if (message.author.bot) return; //เอาไว้กันบอทกวนตีน ถ้าเป็นบอทสงข้อความมาไม่ต้องทำอะไรเลย

    if (message.content === '!check') {
      const data = await this.addressService.getAddressesByDiscordId(
        message.author.id,
      );
      await message.reply(`เจอที่อยู่ทั้งหมด ${data.length} รายการครับ`);
    }
  }
}
