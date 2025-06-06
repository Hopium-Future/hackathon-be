import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { RESET_USER_TIER_QUEUE_NAME } from './constants/common';

@Processor(RESET_USER_TIER_QUEUE_NAME, {
  concurrency: 1,
})
export class UserTierResetQueue extends WorkerHost {
  constructor(private readonly userService: UsersService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { data } = job;
    const { userId } = data;
    await this.userService.processUpgradeTier(userId);
  }
}
