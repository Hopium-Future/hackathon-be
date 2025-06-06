import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FEED_QUEUE_EVENT, FEED_QUEUE_NAME } from './constants/posts';
import { FeedService } from './feed.service';

@Processor(FEED_QUEUE_NAME, {
  concurrency: 1,
})
export class FeedQueue extends WorkerHost {
  private readonly logger = new Logger(FeedQueue.name);

  constructor(private readonly feedService: FeedService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { name, data } = job;
    switch (name) {
      case FEED_QUEUE_EVENT.CREATE_POST: {
        const { userId, orderId, isBot, side, caption } = data;

        if (isBot) {
          await this.feedService.botAutoCreatePost({ userId, orderId, side });
        } else {
          await this.feedService.createPost(userId, { orderId, caption });
        }

        break;
      }
      default:
        this.logger.error(`Unknown job name: ${name}`);
        break;
    }
  }
}
