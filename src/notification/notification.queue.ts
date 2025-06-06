import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_QUEUE_EVENT,
} from './constants/notification.constants';
import { NotificationService } from './notification.service';

@Processor(NOTIFICATION_QUEUE_NAME, {
  concurrency: 1,
})
export class NotificationQueue extends WorkerHost {
  private readonly logger = new Logger(NotificationQueue.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { name } = job;

    this.logger.log(`Processing job ${name}`);

    switch (name) {
      case NOTIFICATION_QUEUE_EVENT.PROCESS_FOLLOWER_NOTIFICATIONS: {
        await this.notificationService.processFollowerNotifications();
        break;
      }
      case NOTIFICATION_QUEUE_EVENT.PROCESS_REFERRAL_NOTIFICATIONS: {
        await this.notificationService.processReferralNotifications();
        break;
      }
      case NOTIFICATION_QUEUE_EVENT.PROCESS_STAR_DONATION_NOTIFICATIONS: {
        await this.notificationService.processStarDonateNotifications();
        break;
      }
      case NOTIFICATION_QUEUE_EVENT.PROCESS_COMMISSION_REFERRALS_NOTIFICATIONS: {
        await this.notificationService.processCommissionReferralsNotification();
        break;
      }
      case NOTIFICATION_QUEUE_EVENT.PROCESS_COMMISSION_SHARES: {
        await this.notificationService.processCommissionShareNotifications();
        break;
      }
      default:
        this.logger.error(`Unknown job name: ${name}`);
        break;
    }
  }
}
