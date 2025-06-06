import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class EmitDto {
  @IsString()
  event: string;

  @IsString()
  @IsOptional()
  channel?: string;

  data: any;
}

export class EmitToUserDto extends EmitDto {
  @IsInt()
  @IsPositive()
  userId: number;
}
