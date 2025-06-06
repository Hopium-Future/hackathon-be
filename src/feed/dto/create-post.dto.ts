import { IsInt, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty()
  @IsInt()
  orderId: number;

  @ApiPropertyOptional()
  @IsString()
  caption?: string;
}

export class BotCreatePostDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsInt()
  orderId: number;

  @ApiProperty()
  @IsString()
  side: string;
}
