import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  Message,
  ChannelType,
  REST,
  Routes,
  Interaction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Partials // 👈 เพิ่มตัวนี้เข้ามา เพื่อให้จัดการ DM ได้สมบูรณ์
} from 'discord.js';
import { AddressService } from '../address/address.service';

// Interface: กำหนดโครงสร้างข้อมูลที่จะเก็บใน State เพื่อให้อ่านง่ายและ Type Safe
interface UserState {
  step: 'AWAITING_NAME' | 'AWAITING_ADDRESS' | 'AWAITING_PHONE' | 'AWAITING_EMAIL';
  data: {
    fullName?: string;
    fullAddress?: string;
    phoneNumber?: string;
    email?: string;
  };
}

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private readonly logger = new Logger(DiscordBotService.name);

  // Storage: เก็บ State ของ User แต่ละคน (User ID -> State)
  private userStates = new Map<string, UserState>();

  constructor(
    private readonly addressService: AddressService,
    private readonly configService: ConfigService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      // 👇 เพิ่ม partials เพื่อให้บอทรับรู้ Channel DM/Message เก่าๆ ได้แม่นยำขึ้น
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
      ]
    });
  }

  async onModuleInit() {
    this.logger.log('🔄 เริ่มต้นการทำงานของ Module DiscordBotService...');

    const token = this.configService.get<string>('DISCORD_TOKEN');
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');

    if (!token || !clientId) {
      this.logger.error('❌ ไม่พบ Token หรือ Client ID');
      return;
    }

    // ---------------------------------------------------------
    // 1. Register Commands (ลงทะเบียนคำสั่ง Slash Command)
    // ---------------------------------------------------------
    await this.registerCommands(token, clientId);

    // ---------------------------------------------------------
    // 2. Setup Event Listeners (ผูกฟังก์ชันกับเหตุการณ์)
    // ---------------------------------------------------------
    this.client.on('interactionCreate', (i) => this.handleInteraction(i));
    this.client.on('messageCreate', (m) => this.handleMessage(m));

    await this.client.login(token);
    this.logger.log('✅ เปิด Bot เรียบร้อยพร้อมทำงาน');
  }

  async onModuleDestroy() {
    this.logger.log('🛑 กำลังปิดการทำงานบอท');
    if (this.client) {
      await this.client.destroy();
      this.logger.log('✅ Shutdown bot เรียบร้อย');
    }
  }

  // =================================================================
  // 🕹️ MAIN HANDLERS (ตัวคัดแยกงานหลัก)
  // =================================================================

  async handleInteraction(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    // ใช้ casting เพื่อแก้ Type Error
    const isDM = (interaction.channel?.type as ChannelType) === ChannelType.DM;

    // --- Route: ส่งงานไปให้ฟังก์ชันย่อยตามชื่อคำสั่ง ---
    if (commandName === 'checkin') await this.handleCheckinCommand(interaction, isDM);
    else if (commandName === 'check') await this.handleCheckCommand(interaction, isDM);
    else if (commandName === 'delete') await this.handleDeleteCommand(interaction, isDM);
  }

  async handleMessage(message: Message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const currentState = this.userStates.get(userId);

    // --- Check: ถ้า User คนนี้ไม่ได้อยู่ในสถานะกรอกข้อมูล ก็จบงาน ---
    if (!currentState) return;

    // --- Guard: ห้ามพิมพ์แทรกใน Server (ต้องทำใน DM เท่านั้น) ---
    if ((message.channel.type as ChannelType) !== ChannelType.DM) {
      await this.enforceDmOnlyPolicy(message);
      return;
    }

    // --- Process: เข้าสู่กระบวนการถาม-ตอบ ---
    await this.processConversationStep(message, currentState, userId);
  }

  // =================================================================
  // 🛡️ SECURITY LOGIC (ระบบป้องกัน)
  // =================================================================

  private async enforceDmOnlyPolicy(message: Message) {
    // ... (Logic ลบข้อความและเตือนให้กลับไป DM) ...
    try {
      if (message.deletable) await message.delete();
      await message.author.send('⚠️ **แจ้งเตือน:** กรุณากรอกข้อมูลใน DM ให้เสร็จก่อนนะครับ');
    } catch (e) { /* Ignore Error */ }
  }

  // =================================================================
  // 💬 CONVERSATION LOGIC (ขั้นตอนการถาม-ตอบ)
  // =================================================================

  private async processConversationStep(message: Message, state: UserState, userId: string) {
    switch (state.step) {
      // --- Step 1: รับชื่อ -> ขอที่อยู่ ---
      case 'AWAITING_NAME':
        state.data.fullName = message.content;
        state.step = 'AWAITING_ADDRESS';
        await message.reply(`ขอบคุณครับคุณ **${message.content}**\n📍 ต่อไปขอ **ที่อยู่จัดส่ง** ครับ`);
        break;

      // --- Step 2: รับที่อยู่ -> ขอเบอร์ ---
      case 'AWAITING_ADDRESS':
        state.data.fullAddress = message.content;
        state.step = 'AWAITING_PHONE';
        await message.reply('รับทราบ! 📞 ขอ **เบอร์โทรศัพท์** ครับ');
        break;

      // --- Step 3: รับเบอร์ -> ขออีเมล ---
      case 'AWAITING_PHONE':
        state.data.phoneNumber = message.content;
        state.step = 'AWAITING_EMAIL';
        await message.reply('สุดท้ายครับ 📧 ขอ **Email** ด้วยครับ');
        break;

      // --- Step 4: รับอีเมล -> บันทึกข้อมูล ---
      case 'AWAITING_EMAIL':
        state.data.email = message.content;
        try {
          // ... (Database Saving Logic) ...
          // ใช้ as any เพื่อ force cast ข้อมูลให้เข้ากับ format ที่ service ต้องการ
          await this.addressService.saveAddress(userId, message.author.username, state.data as any);
          await message.reply('✅ **บันทึกสำเร็จ!** ขอบคุณครับ');
        } catch (error) {
          this.logger.error(error);
          await message.reply('🚨 เกิดข้อผิดพลาด รบกวนเริ่มใหม่นะครับ');
        }
        this.userStates.delete(userId); // Clear State จบงาน
        break;
    }
  }

  // =================================================================
  // 🎮 COMMAND HANDLERS (ไส้ในของแต่ละคำสั่ง)
  // =================================================================

  private async handleCheckinCommand(interaction: ChatInputCommandInteraction, isDM: boolean) {
    // 1. ตั้งค่า State รอรับข้อมูลทันที
    this.userStates.set(interaction.user.id, { step: 'AWAITING_NAME', data: {} });

    const welcomeMsg = 'ยินดีต้อนรับครับ! 🥳 รบกวนขอ **ชื่อ-นามสกุล** ของผู้รับหน่อยครับ';

    if (!isDM) {
      // 2. ถ้าอยู่ Server -> ทัก DM ไปหา
      try {
        await interaction.user.send(welcomeMsg);
        // Reply บอกใน Server (แบบเห็นคนเดียว)
        await interaction.reply({
          content: '📩 **ส่งข้อความไปทาง DM แล้วครับ!** รบกวนเช็คกล่องข้อความส่วนตัวเพื่อกรอกข้อมูลต่อนะครับ',
          ephemeral: true
        });
      } catch (error) {
        // กรณี User ปิด DM
        this.logger.error(`Cannot DM user ${interaction.user.tag}`);
        this.userStates.delete(interaction.user.id);
        await interaction.reply({ content: '❌ **บอททัก DM ไม่ได้ครับ** รบกวนเปิดอนุญาต DM หรือทักบอทมาก่อนนะครับ', ephemeral: true });
      }
    } else {
      // 3. ถ้าอยู่ DM แล้ว -> คุยเลย
      await interaction.reply(welcomeMsg);
    }
  }

  private async handleCheckCommand(interaction: ChatInputCommandInteraction, isDM: boolean) {
    if (!isDM) return interaction.reply({ content: '🔒 ดูใน DM นะครับ', ephemeral: true });

    const addresses = await this.addressService.getAddressesByDiscordId(interaction.user.id);
    if (!addresses || addresses.length === 0) return interaction.reply('📭 ไม่พบข้อมูลครับ');

    // ... (Generate List Logic: แปลง Array เป็น String สวยๆ) ...
    const list = addresses
      .map((addr: any, i: number) => `**${i + 1}.** ${addr.fullName}`)
      .join('\n');

    await interaction.reply(`📋 **ข้อมูลของคุณ:**\n${list}`);
  }

  private async handleDeleteCommand(interaction: ChatInputCommandInteraction, isDM: boolean) {
    if (!isDM) return interaction.reply({ content: '🔒 ลบใน DM เท่านั้นครับ', ephemeral: true });

    // ... (Execute Delete) ...
    const result = await this.addressService.deleteAddressByOwner(interaction.user.id);
    const count = (result as any).count ?? 'ข้อมูล';
    await interaction.reply(`🗑️ ลบข้อมูลเรียบร้อย (${count} รายการ)`);
  }

  // =================================================================
  // 🔧 UTILS
  // =================================================================
  private async registerCommands(token: string, clientId: string) {
    const commands = [
      { name: 'checkin', description: 'เริ่มลงทะเบียน (DM)' },
      { name: 'check', description: 'ดูข้อมูล (DM)' },
      { name: 'delete', description: 'ลบข้อมูล (DM)' },
    ];
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      this.logger.log('✅ Registered Slash Commands');
    } catch (e) {
      this.logger.error('Failed to register commands', e);
    }
  }
}