import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { TelegramUser, UserHeader } from './type/auth.type';
import Axios from 'axios';
import { LoginDto } from './dto/login.dto';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { AuthConfig, Config } from 'src/configuration/config.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly authClient: Axios.AxiosInstance;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<Config>,
  ) {
    const authConfig = this.configService.get<AuthConfig>('auth');

    this.authClient = Axios.create({
      baseURL: authConfig.authBaseUrl,
      timeout: 10000,
      headers: {
        'X-API-KEY': authConfig.authApiKey,
      },
    });
  }

  async login(data: LoginDto) {
    let teleUser: TelegramUser;

    const isDevelopment =
      this.configService.get<string>('environment') === 'development';
    if (isDevelopment && data.initData === 'testvipromax') {
      // FAKE USER
      teleUser = {
        id: 999999,
        username: 'testuser',
        first_name: 'Super Test',
        last_name: 'Vip Pro',
        added_to_attachment_menu: false,
        allows_write_to_pm: false,
        language_code: 'en',
        is_premium: false,
        photo_url: '',
        is_bot: false,
      };
    } else {
      try {
        const res = await this.authClient.post<TelegramUser>(
          '/validate-telegram-token',
          {
            initData: data.initData,
            hostname: data.hostname,
          },
        );

        teleUser = res.data;
      } catch (error) {
        throw new UnauthorizedException('Invalid token');
      }
    }

    if (!teleUser.id) throw new UnauthorizedException('Invalid token');

    const { user, isNew } = await this.usersService.updateOrCreateUser({
      telegramId: teleUser.id,
      username: teleUser.username,
      firstName: teleUser.first_name,
      lastName: teleUser.last_name,
      addedToAttachmentMenu: teleUser.added_to_attachment_menu,
      allowsWriteToPm: teleUser.allows_write_to_pm,
      languageCode: teleUser.language_code,
      isPremium: teleUser.is_premium,
      photoUrl: teleUser.photo_url,
    });

    const res = await this.authClient.post<{ token: string }>('/sign-token', {
      id: user._id,
      telegram_id: user.telegramId,
      username: user.username,
      is_premium: user.isPremium,
    });

    return {
      user,
      token: res.data.token,
      isNew,
    };
  }

  parseUserFromHeader(authHeader: string) {
    const userHeader = JSON.parse(authHeader as string);

    if (!userHeader.id) throw new Error('User id is required');

    const user: UserHeader = {
      id: userHeader.id,
      telegramId: userHeader.telegram_id,
      isPremium: userHeader.is_premium,
      username: userHeader.username,
    };
    return user;
  }
}
