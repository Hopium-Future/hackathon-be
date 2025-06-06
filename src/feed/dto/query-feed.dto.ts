import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryOffsetDto } from 'src/commons/dtos/pagination-query.dto';
import { CallListType } from '../constants/orders';

export class QueryFeedDto extends PaginationQueryOffsetDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  @IsBoolean()
  isFollowing: boolean;
}

export class QueryFeedByIdDto extends PaginationQueryOffsetDto {
  @ApiPropertyOptional({ enum: CallListType })
  @IsOptional()
  @IsEnum(CallListType)
  type?: CallListType;
}

export class GetInvoiceLinkQueryDto {
  @ApiProperty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  resetLink?: boolean = false;
}
