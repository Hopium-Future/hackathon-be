export class SendNoticeTemplateDto {
  telegramId: number;
  templateName: string;
  params: Record<string, string | number>;
}

export class SendNotifyDto {
  template: string;
  userId: number;
  context: Record<string, string | number>;
}
