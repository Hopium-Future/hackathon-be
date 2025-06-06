import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';

export class FindUserByTelegramIdDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  disableCache?: boolean;
}

export class MapUserTelegramIdsDto {
  @ApiProperty({
    isArray: true,
    anyOf: [{ type: 'number' }],
  })
  @IsArray()
  @IsInt({ each: true })
  userIds: number[];
}
