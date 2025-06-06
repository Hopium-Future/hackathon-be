import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

@Module({
  controllers: [],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
