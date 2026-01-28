import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // เอาไว้ทดสอบว่า Server กุยังทำงานใช้อยู่มั้ย
  getHealthCheck(): string {
    return 'discord Bot Server is running!!!!!';
  }
}
