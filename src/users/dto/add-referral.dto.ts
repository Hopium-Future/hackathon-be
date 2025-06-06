import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AddReferralDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  referralCode: string;
}
