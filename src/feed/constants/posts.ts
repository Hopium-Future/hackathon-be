export enum PostStatus {
  CLOSED = 0,
  ACTIVE = 1,
  CANCELLED = 2,
  PENDING = 3,
}

export const FEED_QUEUE_NAME = 'feed';
export const FEED_QUEUE_EVENT = {
  CREATE_POST: 'create_post',
};
