import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { UserHeader } from 'src/auth/type/auth.type';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { ParseObjectIdPipe } from 'src/commons/pipes/parse-object-id.pipe';
import {
  GetInvoiceLinkQueryDto,
  QueryFeedDto,
  QueryFeedByIdDto,
} from './dto/query-feed.dto';
import { OrderService } from '../orders/order.service';

@Controller('feed')
@ApiBearerAuth()
@ApiTags('feed')
@UseGuards(AuthGuard, ThrottlerGuard)
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly orderService: OrderService
  ) {}

  @Get()
  async getFeed(
    @Query() query: QueryFeedDto,
    @UserAuth() userData: UserHeader,
  ) {
    return await this.feedService.getFeed(userData.id, query);
  }

  @Post('/posts')
  createPost(@Body() data: CreatePostDto, @UserAuth() userData: UserHeader) {
    return this.feedService.createPost(userData.id, data);
  }

  @Post('/posts/:postId/reactions')
  async createReaction(
    @Body() data: CreateReactionDto,
    @UserAuth() userData: UserHeader,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    await this.feedService.createReaction({
      postId,
      reaction: data.reaction,
      userId: userData.id,
    });

    return {
      success: true,
    };
  }

  @Post('/posts/:postId/share')
  sharePost(
    @UserAuth() userData: UserHeader,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.feedService.sharePost(userData.id, postId);
  }

  @Get('/posts/:postId/star-invoice')
  getInvoiceLinkForPost(
    @Param('postId', ParseObjectIdPipe) postId: string,
    @Query() query: GetInvoiceLinkQueryDto,
  ) {
    return this.feedService.getInvoiceLink(postId, query);
  }

  @Get('/profile/:userId/earnings')
  async getUserEarning(@Param('userId') userId: number) {
    return this.orderService.getUserEarnings(userId);
  }

  @Get('/profile/:userId/top-stars')
  async getTopStars(@Param('userId') userId: number) {
    return this.feedService.getTopStars(userId);
  }

  @Get('/profile/:userId/call-list')
  async getFeedById(
    @Param('userId') userId: number,
    @UserAuth() userData: UserHeader,
    @Query() query: QueryFeedByIdDto,
  ) {
    return this.feedService.getFeedByUserId(userId, userData.id, query);
  }

  @Get('profile/:userId')
  async getUserProfile(
    @Param('userId') userId: number,
    @UserAuth() userData: UserHeader,
  ) {
    const viewerId = userData.id;
    return this.feedService.getUserProfile(userId, viewerId);
  }

  @Get('/profile/:userId/achievements')
  async getUserAchievements(@Param('userId') userId: number) {
    return this.feedService.getUserAchievements(userId);
  }
}
