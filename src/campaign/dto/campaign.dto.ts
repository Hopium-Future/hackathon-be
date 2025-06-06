import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignReward {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  assetId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  assetQuantity?: number;
}
