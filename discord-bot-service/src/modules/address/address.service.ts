import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * ก้อนที่ 1: บันทึกหรืออัปเดตข้อมูลผู้ใช้พร้อมที่อยู่ใหม่
   */
  async saveAddress(
    discordId: string,
    username: string,
    addressData: { fullName: string; fullAddress: string; phoneNumber: string },
  ) {
    try {
      this.logger.log(`กำลังบันทึกที่อยู่ให้ User: ${username} (${discordId})`);

      const result = await this.prisma.user.upsert({
        where: { discordId },
        update: {
          username: username,
          addresses: {
            create: {
              fullName: addressData.fullName,
              fullAddress: addressData.fullAddress,
              phoneNumber: addressData.phoneNumber,
            },
          },
        },
        create: {
          discordId,
          username,
          addresses: {
            create: {
              fullName: addressData.fullName,
              fullAddress: addressData.fullAddress,
              phoneNumber: addressData.phoneNumber,
            },
          },
        },
      });

      await this.prisma.botLog.create({
        data: {
          action: 'SAVE_ADDRESS',
          details: `บันทึกที่อยู่ใหม่ของ ${username}`,
          userId: result.id,
        },
      });

      return result;
    } catch (error: unknown) {
      // ใช้ instanceof เพื่อเข้าถึง .stack อย่างปลอดภัย
      const errorMessage =
        error instanceof Error ? error.stack : 'Unknown error';
      this.logger.error('เกิดข้อผิดพลาดในการบันทึกที่อยู่:', errorMessage);
      throw error;
    }
  }

  /**
   * ก้อนที่ 2: ดึงรายการที่อยู่ทั้งหมดของ User
   */
  async getAddressesByDiscordId(discordId: string) {
    return this.prisma.address.findMany({
      where: {
        user: { discordId },
      },
      orderBy: {
        createdAt: 'desc',
      }, // <-- ปิดปีกกาของ orderBy
    });  // <-- ปิดปีกกาของ findMany และปิดวงเล็บ
  }

  /**
   * ก้อนที่ 3: ลบที่อยู่
   */
  async deleteAddress(addressId: number) {
    return this.prisma.address.delete({
      where: { id: addressId },
    });
  }
}
