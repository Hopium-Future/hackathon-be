import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Reactions } from '../constants/reactions';

export class CreateReactionDto {
  @ApiProperty({
    enum: Object.values(Reactions),
  })
  @IsEnum(Object.values(Reactions))
  reaction: string;
}
