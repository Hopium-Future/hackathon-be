import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Axios from 'axios';
import { ChatbotConfig, Config } from 'src/configuration/config.interface';
import { SendNoticeTemplateDto, SendNotifyDto } from './dto/send-notice.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly client: Axios.AxiosInstance;
  constructor(private readonly configService: ConfigService<Config>) {
    const chatbotConfig = this.configService.get<ChatbotConfig>('chatbot');
    this.client = Axios.create({
      baseURL: chatbotConfig.apiBaseUrl,
      timeout: 10000,
      headers: {
        'X-API-KEY': chatbotConfig.apiKey,
      },
    });
  }

  async sendNoticeTemplate(data: SendNoticeTemplateDto) {
    try {
      await this.client.post('/notice/send-template', {
        userId: data.telegramId,
        templateName: data.templateName,
        params: data.params,
      });
    } catch (error) {
      this.logger.error('Error sendNoticeTemplate: ', error);
    }
  }

  async sendChatBotNotify(data: SendNotifyDto) {
    const { userId } = data;
    try {
      const rs = await this.client.post(
        '/push-notification',
        {
          notification: [data],
        },
        {
          headers: {
            'X-AUTH-USER': JSON.stringify({ id: userId }),
          },
        },
      );
      return rs.data;
    } catch (error) {
      this.logger.error('Error sendChatBotNotify: ', error.message);
    }
  }
}
