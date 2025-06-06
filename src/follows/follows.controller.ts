import {
  Body,
  Controller,
  Delete,
  Get, HttpException, HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FollowsService } from './follows.service';
import { FollowDto, SearchUserDto } from './dto/follow.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { UserHeader } from 'src/auth/type/auth.type';
import { QueryFollowingDto } from './dto/query-following.dto';
import { QueryFollowerDto } from './dto/query-follower.dto';

@Controller('follows')
@ApiBearerAuth()
@ApiTags('follows')
@UseGuards(AuthGuard, ThrottlerGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get()
  getListFollowing(
    @UserAuth() userData: UserHeader,
    @Query() query: QueryFollowingDto,
  ) {
    return this.followsService.getListFollowing(userData.id, query);
  }

  @Post()
  async follow(@Body() data: FollowDto, @UserAuth() userData: UserHeader) {
    await this.followsService.follow(userData.id, data.followingId);
    return {
      success: true,
    };
  }

  @Delete(':followingId')
  async unfollow(
    @UserAuth() userData: UserHeader,
    @Param('followingId', ParseIntPipe) followingId: number,
  ) {
    await this.followsService.unfollow(userData.id, followingId);
    return {
      success: true,
    };
  }

  @Get('followers')
  getListFollowers() {
    return this.followsService.getListFollower();
  }

  @Get('profile/:userId/followings')
  getListUserFollowing(
    @UserAuth() userData: UserHeader,
    @Query() query: QueryFollowingDto,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.followsService.getListUserFollowing(userData.id, userId, query);
  }

  @Get('profile/:userId/followers')
  getListUserFollowers(
    @UserAuth() userData: UserHeader,
    @Query() query: QueryFollowerDto,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.followsService.getListUserFollower(userData.id, userId, query);
  }

  @Get('recommend/followings')
  getListUserRecommendFollowing(
    @UserAuth() userData: UserHeader,
  ) {
    return this.followsService.getListUserRecommendFollowing(userData.id);
  }

  @Post('search')
  async searchUser(
    @UserAuth() userData: UserHeader,
    @Body() data: SearchUserDto,
  ) {
    try {
      return await this.followsService.searchUser(userData.id, data.keyword);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
