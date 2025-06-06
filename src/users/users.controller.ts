import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserHeader } from 'src/auth/type/auth.type';
import { AddReferralDto } from './dto/add-referral.dto';
import { FriendQueryDto } from './dto/friend-query.dto';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { UserCacheInterceptor } from 'src/commons/interceptors/user-cache.interceptor';
import { ApiKeyGuard } from 'src/auth/apikey.guard';
import {
  FindUserByTelegramIdDto,
  MapUserTelegramIdsDto,
} from './dto/user-query.dto';
import { TIME_MS } from 'src/commons/constants/time';
import { MessagePattern, Payload, Transport } from "@nestjs/microservices";
import { CHATBOT_EVENTS } from "../chatbot/constants/events";

@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Post('add-referral')
  async addReferral(
    @UserAuth() userData: UserHeader,
    @Body() data: AddReferralDto,
  ) {
    try {
      return await this.usersService.addReferral(
        userData.id,
        data.referralCode,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @CacheTTL(10 * TIME_MS.SECOND)
  @UseInterceptors(UserCacheInterceptor, ThrottlerGuard)
  @UseGuards(AuthGuard)
  @Get('info')
  async getUserInfo(@UserAuth() userData: UserHeader) {
    try {
      return await this.usersService.getUserInfo(userData.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @CacheTTL(10 * TIME_MS.SECOND)
  @UseInterceptors(UserCacheInterceptor, ThrottlerGuard)
  @UseGuards(AuthGuard)
  @Get('hopium-info')
  async getHopiumInfo(@UserAuth() userData: UserHeader) {
    try {
      return await this.usersService.getHopiumInfo(userData.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @CacheTTL(1 * TIME_MS.MINUTE)
  @UseInterceptors(UserCacheInterceptor, ThrottlerGuard)
  @UseGuards(AuthGuard)
  @Get('friends')
  async getFriends(
    @UserAuth() userData: UserHeader,
    @Query() query: FriendQueryDto,
  ) {
    try {
      return await this.usersService.getFriends(userData.id, query);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    required: true,
  })
  @Get('/internal/:telegramId')
  async getUserByTelegramId(
    @Param('telegramId', ParseIntPipe) telegramId: number,
    @Query() query: FindUserByTelegramIdDto,
  ) {
    const user = await this.usersService.getUserByTelegramIdCached(
      telegramId,
      query.disableCache,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    required: true,
  })
  @Post('/internal/map-ids')
  async mapUserTelegramIds(@Body() data: MapUserTelegramIdsDto) {
    return this.usersService.mapUserTelegramIds(data.userIds);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Put('update-onboarding')
  async updateOnboarding(@UserAuth() userData: UserHeader) {
    try {
      return await this.usersService.updateOnboarding(userData.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Chatbot events
  @MessagePattern(CHATBOT_EVENTS.USER_GETINFO, Transport.KAFKA)
  async getUserInfoKafka(@Payload() data: { id: number }) {
    try {
      return await this.usersService.getUserInfoAchievement(data.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
