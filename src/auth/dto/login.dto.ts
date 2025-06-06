import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsString()
  initData: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostname: string;
}
