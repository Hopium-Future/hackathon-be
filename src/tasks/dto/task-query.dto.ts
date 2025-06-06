import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Group } from '../type/task.type';

export class TaskQueryDto {
  @ApiPropertyOptional({
    enum: Group,
  })
  @IsOptional()
  @IsEnum(Group)
  group?: Group;
}
