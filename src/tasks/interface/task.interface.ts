import { Task } from '../schemas/task.schema';

export interface TaskWithStatus extends Task {
  status?: string;
}
