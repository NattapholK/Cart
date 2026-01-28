import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [AddressModule],
  providers: [DiscordBotService],
})
export class DiscordBotModule {}
