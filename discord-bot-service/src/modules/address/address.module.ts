import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AddressService],
  controllers: [AddressController],
  exports: [AddressService], // <--- เพิ่มบรรทัดนี้ลงไป! เพื่อให้ Module อื่น "ยืม" ไปใช้ได้
})
export class AddressModule {}
