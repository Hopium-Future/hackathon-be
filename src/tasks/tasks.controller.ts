import { TasksService } from './tasks.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Put,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Body,
  Post,
} from '@nestjs/common';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { TaskQueryDto } from './dto/task-query.dto';
import { UserHeader } from 'src/auth/type/auth.type';
import { ThrottlerUserGuard } from 'src/commons/guards/throttler-user.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyGuard } from 'src/auth/apikey.guard';
import { TaskOtherDto } from './dto/task-other.dto';

@ApiBearerAuth()
@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseGuards(AuthGuard, ThrottlerGuard)
  async getTasks(@UserAuth() user: UserHeader, @Query() query: TaskQueryDto) {
    return this.tasksService.getUserTasks(user.id, query);
  }

  @Put('click/:taskId')
  @UseGuards(AuthGuard, ThrottlerUserGuard)
  @Throttle({ default: { limit: 1, ttl: 300 } })
  async updateUserTaskStatus(
    @UserAuth() user: UserHeader,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.updateUserTaskClickable(user.id, taskId);
  }

  @Put('claim/:taskId')
  @UseGuards(AuthGuard, ThrottlerUserGuard)
  @Throttle({ default: { limit: 1, ttl: 300 } })
  async claimTask(
    @UserAuth() user: UserHeader,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.claimTask(user.id, taskId);
  }

  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    required: true,
  })
  @Get('/daily/hard-reset')
  async hardResetDailyReward() {
    const result = await this.tasksService.hardResetDailyReward();
    return result;
  }

  // @Post('claim/other')
  // @UseGuards(AuthGuard)
  // async claimOtherTask(
  //   @UserAuth() user: UserHeader,
  //   @Body() data: TaskOtherDto,
  // ) {
  //   return await this.tasksService.claimOtherTask(user.id, data);
  // }

  @Get('claim/other/:code/:orderId')
  @UseGuards(AuthGuard)
  async getOtherTaskClaimed(
    @UserAuth() user: UserHeader,
    @Param('code') code: string,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return await this.tasksService.isOtherTaskClaimed(user.id, code, orderId);
  }
}
