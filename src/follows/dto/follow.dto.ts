import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class FollowDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  followingId: number;
}
export class SearchUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  keyword: string;
}
