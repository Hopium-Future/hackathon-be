export type TelegramUser = {
  added_to_attachment_menu: boolean;
  allows_write_to_pm: boolean;
  first_name: string;
  id: number;
  is_bot: boolean;
  is_premium: boolean;
  last_name: string;
  username: string;
  language_code: string;
  photo_url: string;
};

export type UserHeader = {
  id: number;
  telegramId: number;
  username: string;
  isPremium: boolean;
};
