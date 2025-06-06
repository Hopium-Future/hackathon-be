import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiProperty({
    nullable: true,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiProperty({
    nullable: true,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Max(100)
  readonly limit?: number = 10;

  skip = 0;
}

export class PaginationQueryOffsetDto {
  @ApiProperty({
    nullable: true,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number = 0;

  @ApiProperty({
    nullable: true,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Max(100)
  readonly limit?: number = 30;
}
